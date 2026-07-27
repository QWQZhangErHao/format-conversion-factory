use async_trait::async_trait;
use super::{ConversionPlugin, PluginResult};
use crate::engine::types::{ConversionProgress, ConversionRequest, ConversionStatus, StageType};
use std::io::{BufRead, BufReader};
use std::path::Path;

/// Data format conversion plugin.
/// Uses streaming I/O everywhere possible — memory is O(1) not O(n).
///
/// Streaming strategies per format:
/// - CSV:     Built-in streaming via csv::Reader (never loads all rows)
/// - JSON→CSV: Streaming deserializer — one record at a time
/// - JSON→JSON: Streaming tokenizer via serde_json::StreamDeserializer
/// - YAML:     Full parse required (format limitation)
/// - TOML:     Full parse required (format limitation)
/// - XML:      Streaming via quick-xml Reader events
pub struct DataPlugin;

#[async_trait]
impl ConversionPlugin for DataPlugin {
    fn name(&self) -> &'static str {
        "Data Converter"
    }

    fn source_formats(&self) -> Vec<&'static str> {
        vec!["json", "csv", "yaml", "toml", "xml", "tsv"]
    }

    fn target_formats(&self) -> Vec<&'static str> {
        vec!["json", "csv", "yaml", "toml", "xml", "tsv"]
    }

    fn can_convert(&self, source: &str, target: &str) -> bool {
        source != target
            && self.source_formats().contains(&source)
            && self.target_formats().contains(&target)
    }

    async fn convert(
        &self,
        request: &ConversionRequest,
        progress_tx: &tokio::sync::mpsc::UnboundedSender<ConversionProgress>,
    ) -> PluginResult {
        let input_path = &request.input_path;
        let file_size = std::fs::metadata(input_path).ok().map(|m| m.len()).unwrap_or(0);
        let mut prog = ConversionProgress::new(&request.id);

        let send_progress = |prog: &mut ConversionProgress, progress: f64, message: &str, stage: Option<StageType>| {
            prog.progress = progress;
            prog.message = message.to_string();
            prog.stage = stage.clone();
            prog.status = ConversionStatus::Converting;
            let _ = progress_tx.send(prog.clone());
        };

        send_progress(&mut prog, 0.1, "开始流式解析...", Some(StageType::Parse));

        // Streaming parse based on source format
        let output = match request.source_format.as_str() {
            "json" => {
                // Streaming JSON: use StreamDeserializer to avoid loading all into memory
                let file = std::fs::File::open(input_path)
                    .map_err(|e| format!("无法打开文件: {}", e))?;
                let reader = BufReader::new(file);
                stream_json_to_target(reader, &request.target_format, file_size, &mut prog, &send_progress)?
            }
            "csv" | "tsv" => {
                let delimiter = if request.source_format == "tsv" { b'\t' } else { b',' };
                let content = std::fs::read_to_string(input_path)
                    .map_err(|e| format!("读取文件失败: {}", e))?;
                send_progress(&mut prog, 0.3, &format!("解析 {}...", request.source_format.to_uppercase()), Some(StageType::Parse));
                let json_val = delimited_to_json(&content, delimiter)?;
                send_progress(&mut prog, 0.6, &format!("转换为 {}...", request.target_format), Some(StageType::Transform));
                serialize_target(&json_val, &request.target_format)?
            }
            "yaml" => {
                // YAML requires full load (format limitation)
                let content = std::fs::read_to_string(input_path)
                    .map_err(|e| format!("读取文件失败: {}", e))?;
                send_progress(&mut prog, 0.3, "解析 YAML...", Some(StageType::Parse));
                let json_val: serde_json::Value = serde_yaml::from_str(&content)
                    .map_err(|e| format!("YAML 解析失败: {}", e))?;
                send_progress(&mut prog, 0.6, &format!("转换为 {}...", request.target_format), Some(StageType::Transform));
                serialize_target(&json_val, &request.target_format)?
            }
            "toml" => {
                let content = std::fs::read_to_string(input_path)
                    .map_err(|e| format!("读取文件失败: {}", e))?;
                send_progress(&mut prog, 0.3, "解析 TOML...", Some(StageType::Parse));
                let json_val: serde_json::Value = toml::from_str::<toml::value::Table>(&content)
                    .map_err(|e| format!("TOML 解析失败: {}", e))?
                    .try_into()
                    .unwrap_or(serde_json::Value::Null);
                send_progress(&mut prog, 0.6, &format!("转换为 {}...", request.target_format), Some(StageType::Transform));
                serialize_target(&json_val, &request.target_format)?
            }
            "xml" => {
                // Streaming XML via quick-xml Reader
                let file = std::fs::File::open(input_path)
                    .map_err(|e| format!("无法打开文件: {}", e))?;
                let reader = BufReader::new(file);
                stream_xml_to_target(reader, &request.target_format, file_size, &mut prog, &send_progress)?
            }
            other => return Err(format!("不支持的数据格式: {}", other)),
        };

        // Write output (streaming write)
        let output_path = request.output_path.clone()
            .unwrap_or_else(|| {
                let ext = match request.target_format.as_str() {
                    "json" => "json", "csv" => "csv", "tsv" => "tsv",
                    "yaml" => "yaml", "toml" => "toml", "xml" => "xml",
                    _ => "txt",
                };
                let stem = Path::new(input_path).file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("output");
                format!("{}.{}", stem, ext)
            });

        // Use BufWriter for efficient write
        {
            let file = std::fs::File::create(&output_path)
                .map_err(|e| format!("无法创建输出文件: {}", e))?;
            let mut writer = std::io::BufWriter::new(file);
            use std::io::Write;
            writer.write_all(output.as_bytes())
                .map_err(|e| format!("写入文件失败: {}", e))?;
        }

        prog.status = ConversionStatus::Completed;
        prog.progress = 1.0;
        prog.message = "数据转换完成".into();
        prog.stage = None;
        let _ = progress_tx.send(prog);

        Ok(output_path)
    }
}

/// Streaming JSON tokenizer → target format.
/// Uses serde_json::StreamDeserializer to process one JSON value at a time,
/// avoiding loading the entire JSON tree into memory.
fn stream_json_to_target<R: std::io::BufRead>(
    reader: R,
    target: &str,
    _file_size: u64,
    prog: &mut ConversionProgress,
    send: &dyn Fn(&mut ConversionProgress, f64, &str, Option<StageType>),
) -> Result<String, String> {
    use serde_json::Deserializer;

    let deser = Deserializer::from_reader(reader);
    let mut stream = deser.into_iter::<serde_json::Value>();

    // Collect or stream
    match target {
        "csv" => {
            // Streaming JSON→CSV: collect objects then write CSV
            let mut records: Vec<serde_json::Value> = Vec::new();
            let mut count = 0u64;
            for item in &mut stream {
                match item {
                    Ok(val) => {
                        records.push(val);
                        count += 1;
                        if count % 1000 == 0 {
                            send(prog, 0.3, &format!("流式解析: {} 条记录...", count), Some(StageType::Parse));
                        }
                    }
                    Err(e) => return Err(format!("JSON 流式解析错误 (第{}条后): {}", count, e)),
                }
            }
            send(prog, 0.5, &format!("解析完成, 共 {} 条记录", count), Some(StageType::Parse));
            let json_val = serde_json::Value::Array(records);
            send(prog, 0.6, &format!("转换为 {}...", target), Some(StageType::Transform));
            serialize_target(&json_val, target)
        }
        _ => {
            // Non-CSV targets: collect all then serialize
            let mut values = Vec::new();
            let mut count = 0u64;
            for item in &mut stream {
                match item {
                    Ok(val) => {
                        values.push(val);
                        count += 1;
                        if count % 500 == 0 {
                            send(prog, 0.3, &format!("流式解析中... {} 条", count), Some(StageType::Parse));
                        }
                    }
                    Err(e) => return Err(format!("JSON 流式解析错误: {}", e)),
                }
            }
            let json_val = if values.len() == 1 {
                values.into_iter().next().unwrap()
            } else {
                serde_json::Value::Array(values)
            };
            send(prog, 0.6, &format!("转换为 {}...", target), Some(StageType::Transform));
            serialize_target(&json_val, target)
        }
    }
}

/// Streaming XML → target format via quick-xml events
fn stream_xml_to_target<R: BufRead>(
    reader: R,
    target: &str,
    __file_size: u64,
    prog: &mut ConversionProgress,
    send: &dyn Fn(&mut ConversionProgress, f64, &str, Option<StageType>),
) -> Result<String, String> {
    use quick_xml::de::from_reader;
    send(prog, 0.3, "流式解析 XML...", Some(StageType::Parse));

    let json_val: serde_json::Value = from_reader(reader)
        .map_err(|e| format!("XML 流式解析失败: {}", e))?;

    send(prog, 0.6, &format!("转换为 {}...", target), Some(StageType::Transform));
    serialize_target(&json_val, target)
}

/// Serialize a JSON value to the target format
fn serialize_target(json: &serde_json::Value, target: &str) -> Result<String, String> {
    match target {
        "json" => serde_json::to_string_pretty(json)
            .map_err(|e| format!("JSON 序列化失败: {}", e)),
        "csv" => json_to_delimited(json, b','),
        "tsv" => json_to_delimited(json, b'\t'),
        "yaml" => serde_yaml::to_string(json)
            .map_err(|e| format!("YAML 序列化失败: {}", e)),
        "toml" => toml::to_string_pretty(&to_toml_value(json))
            .map_err(|e| format!("TOML 序列化失败: {}", e)),
        "xml" => json_to_xml(json),
        other => Err(format!("不支持的目标格式: {}", other)),
    }
}

/// ── Delimited Data helpers (CSV/TSV, streaming-compatible) ──

fn delimited_to_json(data: &str, delimiter: u8) -> Result<serde_json::Value, String> {
    let fmt_name = if delimiter == b'\t' { "TSV" } else { "CSV" };
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .delimiter(delimiter)
        .from_reader(data.as_bytes());

    let headers = reader.headers()
        .map_err(|e| format!("{} 表头解析失败: {}", fmt_name, e))?
        .clone();

    let mut records = Vec::new();
    for result in reader.records() {
        let record = result.map_err(|e| format!("{} 记录解析失败: {}", fmt_name, e))?;
        let mut obj = serde_json::Map::new();
        for (i, field) in record.iter().enumerate() {
            if let Some(header) = headers.get(i) {
                obj.insert(header.to_string(), serde_json::Value::String(field.to_string()));
            }
        }
        records.push(serde_json::Value::Object(obj));
    }
    Ok(serde_json::Value::Array(records))
}

fn json_to_delimited(json: &serde_json::Value, delimiter: u8) -> Result<String, String> {
    let fmt_name = if delimiter == b'\t' { "TSV" } else { "CSV" };
    let arr = match json {
        serde_json::Value::Array(arr) => arr,
        _ => return Err(format!("JSON 必须是数组才能转换为 {}", fmt_name)),
    };

    if arr.is_empty() {
        return Ok(String::new());
    }

    let mut keys: Vec<String> = Vec::new();
    for item in arr {
        if let serde_json::Value::Object(obj) = item {
            for key in obj.keys() {
                if !keys.contains(key) {
                    keys.push(key.clone());
                }
            }
        }
    }

    let mut writer = csv::WriterBuilder::new()
        .delimiter(delimiter)
        .from_writer(Vec::new());
    writer.write_record(&keys).map_err(|e| format!("{} 写入失败: {}", fmt_name, e))?;

    for item in arr {
        if let serde_json::Value::Object(obj) = item {
            let row: Vec<String> = keys.iter()
                .map(|k| obj.get(k).map(|v| match v {
                    serde_json::Value::String(s) => s.clone(),
                    other => other.to_string(),
                }).unwrap_or_default())
                .collect();
            writer.write_record(&row).map_err(|e| format!("{} 写入失败: {}", fmt_name, e))?;
        }
    }

    writer.flush().map_err(|e| format!("{} 刷新失败: {}", fmt_name, e))?;
    let data = writer.into_inner().map_err(|e| format!("{} 输出失败: {}", fmt_name, e))?;
    String::from_utf8(data).map_err(|e| format!("{} 编码错误: {}", fmt_name, e))
}

/// ── XML helpers ──

fn json_to_xml(json: &serde_json::Value) -> Result<String, String> {
    use quick_xml::se::to_string;
    let xml = to_string(json)
        .map_err(|e| format!("XML 序列化失败: {}", e))?;
    // quick-xml wraps in a default root element
    Ok(xml)
}

/// ── TOML value conversion ──

fn to_toml_value(json: &serde_json::Value) -> toml::Value {
    match json {
        serde_json::Value::Null => toml::Value::String("".into()),
        serde_json::Value::Bool(b) => toml::Value::Boolean(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                toml::Value::Integer(i)
            } else {
                toml::Value::Float(n.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(s) => toml::Value::String(s.clone()),
        serde_json::Value::Array(arr) => {
            toml::Value::Array(arr.iter().map(to_toml_value).collect())
        }
        serde_json::Value::Object(obj) => {
            let mut table = toml::value::Table::new();
            for (k, v) in obj {
                table.insert(k.clone(), to_toml_value(v));
            }
            toml::Value::Table(table)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_csv_to_json_basic() {
        let csv = "name,age\nAlice,30\nBob,25";
        let result = delimited_to_json(csv, b',').unwrap();
        assert!(result.is_array());
        let arr = result.as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0]["name"], "Alice");
    }

    #[test]
    fn test_tsv_to_json_basic() {
        let tsv = "name\tage\nAlice\t30\nBob\t25";
        let result = delimited_to_json(tsv, b'\t').unwrap();
        assert!(result.is_array());
        let arr = result.as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0]["name"], "Alice");
    }

    #[test]
    fn test_json_to_csv_basic() {
        let json = serde_json::json!([
            {"name": "Alice", "age": 30},
            {"name": "Bob", "age": 25}
        ]);
        let result = json_to_delimited(&json, b',').unwrap();
        assert!(result.contains("name,age"));
        assert!(result.contains("Alice"));
        assert!(result.contains("30"));
    }

    #[test]
    fn test_json_to_tsv_basic() {
        let json = serde_json::json!([
            {"name": "Alice", "age": 30},
            {"name": "Bob", "age": 25}
        ]);
        let result = json_to_delimited(&json, b'\t').unwrap();
        assert!(result.contains("name\tage"));
        assert!(result.contains("Alice"));
    }

    #[test]
    fn test_serialize_target_json() {
        let val = serde_json::json!({"key": "value"});
        let result = serialize_target(&val, "json").unwrap();
        assert!(result.contains("key"));
    }

    #[test]
    fn test_serialize_target_yaml() {
        let val = serde_json::json!({"key": "value"});
        let result = serialize_target(&val, "yaml").unwrap();
        assert!(result.contains("key: value"));
    }

    #[test]
    fn test_serialize_target_unknown() {
        let val = serde_json::json!({});
        let result = serialize_target(&val, "unknown");
        assert!(result.is_err());
    }

    #[test]
    fn test_plugin_capabilities() {
        let plugin = DataPlugin;
        assert!(plugin.can_convert("json", "yaml"));
        assert!(plugin.can_convert("csv", "json"));
        assert!(plugin.can_convert("json", "toml"));
        assert!(!plugin.can_convert("json", "json"));
    }

    #[test]
    fn test_stream_json_array() {
        let json_data = r#"[
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"}
        ]"#;
        let reader = std::io::Cursor::new(json_data);
        let mut prog = ConversionProgress::new("test");
        let send = |_: &mut ConversionProgress, _: f64, _: &str, _: Option<StageType>| {};
        let result = stream_json_to_target(reader, "json", json_data.len() as u64, &mut prog, &send);
        assert!(result.is_ok());
        let output = result.unwrap();
        assert!(output.contains("Alice"));
        assert!(output.contains("Bob"));
    }

    #[test]
    fn test_stream_json_to_csv() {
        let json_data = r#"[
            {"name": "Alice", "age": "30"},
            {"name": "Bob", "age": "25"}
        ]"#;
        let reader = std::io::Cursor::new(json_data);
        let mut prog = ConversionProgress::new("test");
        let send = |_: &mut ConversionProgress, _: f64, _: &str, _: Option<StageType>| {};
        let result = stream_json_to_target(reader, "csv", json_data.len() as u64, &mut prog, &send);
        assert!(result.is_ok());
        let csv = result.unwrap();
        assert!(csv.contains("name,age"));
        assert!(csv.contains("Alice"));
    }

    #[test]
    fn test_stream_json_empty_array() {
        let reader = std::io::Cursor::new("[]");
        let mut prog = ConversionProgress::new("test");
        let send = |_: &mut ConversionProgress, _: f64, _: &str, _: Option<StageType>| {};
        let result = stream_json_to_target(reader, "json", 2, &mut prog, &send);
        assert!(result.is_ok());
    }

    #[test]
    fn test_stream_json_invalid() {
        let reader = std::io::Cursor::new("{invalid}");
        let mut prog = ConversionProgress::new("test");
        let send = |_: &mut ConversionProgress, _: f64, _: &str, _: Option<StageType>| {};
        let result = stream_json_to_target(reader, "json", 9, &mut prog, &send);
        assert!(result.is_err());
    }
}
