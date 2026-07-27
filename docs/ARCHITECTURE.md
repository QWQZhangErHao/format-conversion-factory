# Architecture

See the [architecture section](../README.md#-架构) in the main README for a high-level overview.

## Detailed Design

### Data Flow: Single File Conversion

```
User drops file
     ↓
handleFilesDrop() → detectFormat() → FORMAT_REGISTRY lookup
     ↓
User selects target format → clicks "Convert"
     ↓
startConversion() → convertOne() [concurrency: cores-1]
     ↓
mockConvert()
  ├─ Browser-convertible? → workerClient.convert() [Web Worker]
  │    └─ universalConvert() → IR pipeline → output
  ├─ .docx? → workerClient.extractDocx() [Web Worker]
  │    └─ ZIP parser → XML extract → text
  └─ Other? → tryTauriConvert() → invoke('convert_file')
     ↓
setFiles() → status='done', content=result
     ↓
User clicks "Download" → save dialog or Blob URL
```

### IPC Channel Architecture

```
Frontend                          Rust Backend
──────────────────────────────────────────────────
invoke('convert_file')            → convert_file()
  on_progress: Channel              → on_progress.send(progress)
  ↓                                  ↓
  listen('conversion-progress')    ← emit('conversion-progress', p)
```

### Plugin System

```
PluginRegistry
 ├── DocumentPlugin: md ↔ html ↔ txt
 ├── ImagePlugin:    png ↔ jpeg ↔ webp ↔ gif ↔ bmp ↔ ico
 ├── DataPlugin:     json ↔ csv ↔ tsv ↔ yaml ↔ toml ↔ xml
 └── [WasmPlugin]:   .wasm plugins (future)
```

### Security Layers

| Layer | Mechanism |
|-------|-----------|
| Path traversal | validate_path() — rejects `..`, null bytes, device names |
| XSS | SafeDiffPreview — React DOM rendering, no innerHTML |
| Mutex poison | unwrap_or_else(|p| p.into_inner()) — recover + log |
| Temp files | TempFileGuard — RAII auto-cleanup + startup GC |
| File spoofing | infer magic bytes + FORMAT_SIGNATURES double-check |
| Large files | 10MB chunked streaming validation |
