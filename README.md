<div align="center">
  <br/>
  <img src="apps/desktop/src-tauri/icons/128x128@2x.png" alt="Format Conversion Factory" width="128" />
  <h1>格式转换工厂 · Format Conversion Factory</h1>
  <p><strong>Universal file format converter with Apple-style UI · 万能文件格式转换器</strong></p>
  <p>Tauri v2 + React 19 — Cross-platform Desktop App / 跨平台桌面应用</p>

  <p>
    <a href="#features">Features 功能</a> ·
    <a href="#installation">Installation 安装</a> ·
    <a href="#usage">Usage 使用</a> ·
    <a href="#architecture">Architecture 架构</a> ·
    <a href="#development">Development 开发</a>
  </p>

  <p>
    <img src="https://img.shields.io/github/v/release/QWQZhangErHao/format-conversion-factory?style=flat-square" alt="Release" />
    <img src="https://img.shields.io/github/license/QWQZhangErHao/format-conversion-factory?style=flat-square" alt="License" />
    <img src="https://img.shields.io/github/actions/workflow/status/QWQZhangErHao/format-conversion-factory/ci.yml?style=flat-square" alt="CI" />
    <img src="https://img.shields.io/badge/Rust-1.85+-orange?style=flat-square" alt="Rust" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square" alt="React" />
    <img src="https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square" alt="Tauri" />
  </p>
</div>

<br/>

**格式转换工厂** 是一款基于 Tauri v2 + React 19 的跨平台桌面应用，提供直观的 Apple 风格界面，支持 24+ 种文件格式的互相转换。支持文本格式实时预览、批量转换队列、多线程并发处理。

**Format Conversion Factory** is a cross-platform desktop app built with Tauri v2 + React 19, featuring an intuitive Apple-style interface. It supports conversion between 24+ file formats, real-time preview for text formats, batch conversion queues, and multi-threaded concurrent processing.

---

## Features · 功能特性

### 🔄 Format Support · 支持格式

| Category 类别 | Formats 格式 |
|--------------|-------------|
| **Data** 数据 | JSON, CSV, YAML, TOML, XML |
| **Document** 文档 | Markdown, HTML, TXT |
| **Image** 图片 | PNG, JPEG, WebP, BMP, GIF, TIFF, SVG, ICO |
| **Office** 办公 | DOCX, XLSX |
| **E-book** 电子书 | EPUB |
| **Config** 配置 | INI, Properties, PLIST |

### 🎨 Key Features · 核心特性

- **Apple-style UI** — Clean, native-feeling interface following Apple Design System / 清爽的原生感界面，遵循 Apple 设计规范
- **Real-time Preview** — Instantly preview text format conversions / 文本格式转换即时预览
- **Batch Conversion** — Queue multiple files for batch processing / 多文件排队批量处理
- **Multi-threaded** — Concurrent processing for faster conversions / 并发处理，转换更快速
- **Drag & Drop** — Intuitive drag-and-drop file import / 直观的拖拽导入
- **Cross-platform** — Windows, macOS, Linux support / 支持 Windows、macOS、Linux

---

## Installation · 安装

### Download · 下载

Download the latest release from the [Releases page](https://github.com/QWQZhangErHao/format-conversion-factory/releases).

从 [Releases 页面](https://github.com/QWQZhangErHao/format-conversion-factory/releases) 下载最新版本。

| Platform 平台 | Format 格式 |
|--------------|-------------|
| Windows | `.msi` / `.exe` |
| macOS | `.dmg` (Apple Silicon + Intel) |
| Linux | `.deb` / `.AppImage` |

### Build from source · 源码构建

```bash
# Prerequisites / 前置条件
# Install Rust: https://rustup.rs
# Install Node.js 20+

git clone https://github.com/QWQZhangErHao/format-conversion-factory.git
cd format-conversion-factory

# Install dependencies / 安装依赖
pnpm install

# Development mode / 开发模式
pnpm tauri dev

# Production build / 生产构建
pnpm tauri build
```

---

## Architecture · 架构

```
format-conversion-factory/
├── apps/
│   ├── desktop/              # Tauri desktop app / 桌面应用
│   │   ├── src-tauri/        # Rust backend / Rust 后端
│   │   │   ├── src/          # Rust source / Rust 源码
│   │   │   │   ├── converter/  # Conversion engines / 转换引擎
│   │   │   │   ├── ffmpeg/     # FFmpeg integration / FFmpeg 集成
│   │   │   │   └── utils/      # Utilities / 工具函数
│   │   │   └── icons/        # App icons / 应用图标
│   │   └── src/              # React frontend / React 前端
│   │       ├── components/   # UI components / UI 组件
│   │       ├── hooks/        # Custom hooks / 自定义 Hooks
│   │       └── lib/          # Utilities / 工具库
│   └── docs/                 # Documentation / 文档
├── packages/
│   └── shared/               # Shared types / 共享类型
└── turbo.json                # Turborepo config
```

### Tech Stack · 技术栈

| Layer 层级 | Technology 技术 |
|-----------|-----------------|
| **Desktop Shell** | Tauri v2 (Rust) |
| **Frontend** | React 19, TypeScript, Vite |
| **Conversion** | Rust native converters + FFmpeg |
| **Monorepo** | Turborepo, pnpm workspace |
| **CI/CD** | GitHub Actions |

---

## Development · 开发

```bash
# Start dev server / 启动开发服务器
pnpm tauri dev

# Run linter / 运行代码检查
pnpm lint

# Type check / 类型检查
pnpm typecheck

# Build for production / 生产构建
pnpm tauri build
```

### Prerequisites · 前置条件

- [Rust](https://rustup.rs) 1.85+
- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 9+
- System dependencies for Tauri v2 (see [Tauri docs](https://v2.tauri.app/start/prerequisites/))

---

## 🤝 Contributing · 贡献指南

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

欢迎贡献！请阅读我们的[贡献指南](CONTRIBUTING.md)。

---

## 📄 License · 许可

[MIT](LICENSE)
