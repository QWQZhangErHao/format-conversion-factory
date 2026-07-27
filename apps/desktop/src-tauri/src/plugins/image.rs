use async_trait::async_trait;
use super::{ConversionPlugin, PluginResult};
use crate::engine::types::{ConversionProgress, ConversionRequest, ConversionStatus, StageType};
use image::{
    ImageFormat, ImageReader,
    codecs::png::PngEncoder,
    codecs::jpeg::JpegEncoder,
    codecs::webp::WebPEncoder,
};
use std::io::BufWriter;
use std::fs::File;

/// Image format conversion plugin.
/// Handles: PNG ↔ JPEG ↔ WebP ↔ GIF ↔ BMP ↔ ICO
pub struct ImagePlugin;

#[async_trait]
impl ConversionPlugin for ImagePlugin {
    fn name(&self) -> &'static str {
        "Image Converter"
    }

    fn source_formats(&self) -> Vec<&'static str> {
        vec!["png", "jpeg", "webp", "gif", "bmp", "ico"]
    }

    fn target_formats(&self) -> Vec<&'static str> {
        vec!["png", "jpeg", "webp", "gif", "bmp", "ico"]
    }

    fn can_convert(&self, source: &str, target: &str) -> bool {
        source != target // No-op conversion not supported
            && self.source_formats().contains(&source)
            && self.target_formats().contains(&target)
    }

    async fn convert(
        &self,
        request: &ConversionRequest,
        progress_tx: &tokio::sync::mpsc::UnboundedSender<ConversionProgress>,
    ) -> PluginResult {
        let prog = ConversionProgress::new(&request.id);

        let _ = progress_tx.send(ConversionProgress {
            status: ConversionStatus::Converting,
            progress: 0.2,
            message: "解码图像...".into(),
            stage: Some(StageType::Parse),
            ..prog.clone()
        });

        // Decode the input image
        let img = ImageReader::open(&request.input_path)
            .map_err(|e| format!("无法打开图像: {}", e))?
            .decode()
            .map_err(|e| format!("图像解码失败: {}", e))?;

        // Determine target format
        let target_fmt = match request.target_format.as_str() {
            "png" => ImageFormat::Png,
            "jpeg" | "jpg" => ImageFormat::Jpeg,
            "webp" => ImageFormat::WebP,
            "gif" => ImageFormat::Gif,
            "bmp" => ImageFormat::Bmp,
            "ico" => ImageFormat::Ico,
            other => return Err(format!("不支持的图像格式: {}", other)),
        };

        let _ = progress_tx.send(ConversionProgress {
            status: ConversionStatus::Converting,
            progress: 0.5,
            message: format!("编码为 {}...", request.target_format),
            stage: Some(StageType::Serialize),
            ..prog.clone()
        });

        // Apply resize if requested (钳位宽高 ≥ 1)
        let img = if let Some(ref opts) = request.options {
            let w = opts.width.filter(|&v| v > 0).unwrap_or(img.width());
            let h = opts.height.filter(|&v| v > 0).unwrap_or(img.height());
            if w != img.width() || h != img.height() {
                img.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
            } else {
                img
            }
        } else {
            img
        };

        // Determine output path
        let output_path = request.output_path.clone()
            .unwrap_or_else(|| {
                let input = &request.input_path;
                let ext = match target_fmt {
                    ImageFormat::Jpeg => "jpg",
                    ImageFormat::Png => "png",
                    ImageFormat::WebP => "webp",
                    ImageFormat::Gif => "gif",
                    ImageFormat::Bmp => "bmp",
                    ImageFormat::Ico => "ico",
                    _ => "png",
                };
                let stem = std::path::Path::new(input).file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("output");
                format!("{}.{}", stem, ext)
            });

        // Encode and write output
        let file = File::create(&output_path)
            .map_err(|e| format!("无法创建输出文件: {}", e))?;
        let mut writer = BufWriter::new(file);

        // Quality defaults and encoding
        let quality = request.options.as_ref().and_then(|o| o.quality).unwrap_or(90);

        match target_fmt {
            ImageFormat::Png => {
                let encoder = PngEncoder::new(&mut writer);
                img.write_with_encoder(encoder)
                    .map_err(|e| format!("PNG 编码失败: {}", e))?;
            }
            ImageFormat::Jpeg => {
                let q = quality.clamp(1, 100);
                let encoder = JpegEncoder::new_with_quality(&mut writer, q);
                img.write_with_encoder(encoder)
                    .map_err(|e| format!("JPEG 编码失败: {}", e))?;
            }
            ImageFormat::WebP => {
                // image 0.25 只提供无损 WebPEncoder，有损编码需升级 image 版本
                // 目前统一使用无损编码以保持兼容
                let encoder = WebPEncoder::new_lossless(&mut writer);
                img.write_with_encoder(encoder)
                    .map_err(|e| format!("WebP 编码失败: {}", e))?;
            }
            ImageFormat::Gif => {
                img.write_to(&mut writer, ImageFormat::Gif)
                    .map_err(|e| format!("GIF 编码失败: {}", e))?;
            }
            ImageFormat::Bmp => {
                img.write_to(&mut writer, ImageFormat::Bmp)
                    .map_err(|e| format!("BMP 编码失败: {}", e))?;
            }
            ImageFormat::Ico => {
                img.write_to(&mut writer, ImageFormat::Ico)
                    .map_err(|e| format!("ICO 编码失败: {}", e))?;
            }
            _ => return Err("不支持的图像格式".into()),
        }

        let _ = progress_tx.send(ConversionProgress {
            status: ConversionStatus::Completed,
            progress: 1.0,
            message: "图像转换完成".into(),
            stage: None,
            ..prog
        });

        Ok(output_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_capabilities() {
        let plugin = ImagePlugin;
        assert!(plugin.can_convert("png", "jpeg"));
        assert!(plugin.can_convert("jpeg", "webp"));
        assert!(plugin.can_convert("webp", "png"));
        assert!(!plugin.can_convert("png", "png")); // No-op
        assert!(!plugin.can_convert("png", "json"));
    }
}
