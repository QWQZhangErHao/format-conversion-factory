<div align="center">
  <br/>
  <img src="apps/desktop/src-tauri/icons/128x128@2x.png" alt="Format Conversion Factory" width="128" />
  <h1>格式转换工厂</h1>
  <p><strong>Format Conversion Factory</strong></p>
  <p>Universal file format converter with Apple-style UI — Tauri v2 + React 19</p>

  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#usage">Usage</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#development">Development</a> •
    <a href="#limitations">Limitations</a>
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

---

## ✨ 功能亮点

### 核心能力

- **万能格式互转** — 文本/数据格式间任意互转，支持 JSON、CSV、YAML、TOML、XML、Markdown、HTML、纯文本、SQL、TSV
- **图片格式转换** — PNG/JPEG/WebP/GIF/BMP/ICO 无损/有损互转，可调质量
- **文档提取** — DOCX 文件浏览器端 ZIP 解压 + XML 文本提取
- **批量队列** — 最多并发 N-1 个任务（N=CPU 核心数），自适应并发控制
- **实时进度** — 圆形进度环 + 弹性勾选动画
- **差异对比** — 双栏对比视图，显示源与转换后的差异

### 用户体验

- **Apple 风格设计系统** — 毛玻璃 (GlassPanel)、弹性动画 (Spring Physics)、SF 字体栈
- **原生 Finder 定位** — 转换完成后一键在 Finder/Explorer 中显示文件
- **空格键快速预览** — 选中已完成文件按 Space 键立即查看转换对比
- **暗色/亮色模式** — 自适应切换
- **批量暂停/恢复** — 灵活控制转换队列

### 工程特性

- **离线优先** — 所有核心转换在浏览器端完成，无网络也可用
- **Web Worker 隔离** — CPU 密集型转换在独立线程运行，UI 保持 60 FPS
- **零拷贝 IPC** — Tauri v2 Response 直接返回二进制，无 JSON 序列化开销
- **RAII 资源管理** — TempFileGuard 自动清理临时文件
- **安全沙箱** — 路径遍历防护、Mutex 中毒恢复、流式大文件校验

---

## 🖥️ 截图

<!-- TODO: 添加应用截图 -->

---

## 📦 安装

### macOS

```bash
# Homebrew (推荐)
brew install --cask format-conversion-factory

# 或从 GitHub Releases 下载 .dmg
```

### Windows

从 [GitHub Releases](https://github.com/QWQZhangErHao/format-conversion-factory/releases) 下载 `.msi` 安装包。

### Linux

```bash
# Debian/Ubuntu
sudo dpkg -i format-conversion-factory-*.deb

# AppImage
chmod +x format-conversion-factory-*.AppImage
./format-conversion-factory-*.AppImage
```

---

## 🚀 使用

### 基本流程

1. **拖放文件** — 将文件拖入应用窗口，或点击「添加文件」选择
2. **选择格式** — 在「文档」「图片」「数据」分类中选择目标格式
3. **开始转换** — 点击「开始转换」按钮，实时查看进度
4. **下载结果** — 点击「下载」保存到本地，或「在 Finder 中显示」

### 支持的格式

| 分类 | 格式 |
|------|------|
| 文档 | Markdown (.md) · HTML (.html) · 纯文本 (.txt) · DOCX 文本提取 |
| 图片 | PNG · JPEG · WebP · GIF · BMP · ICO |
| 数据 | JSON · CSV · TSV · YAML · TOML · XML · SQL · INI |

> DOCX 作为**源格式**受支持（文本提取），暂不支持生成 .docx 文件。

---

## 🏗️ 架构

```
┌─ UI 层 ─────────────────────────────────────────┐
│  React 19 + Framer Motion + TailwindCSS v4      │
│  Apple GlassPanel · Spring Animation · 60 FPS    │
├─ 转换层 ─────────────────────────────────────────┤
│  Web Worker: universalConvert → IR → renderIR   │
│  Browser: JSON↔CSV/YAML/TOML/XML, MD↔HTML       │
├─ IPC 桥 ─────────────────────────────────────────│
│  Tauri v2 invoke + Channel 流式进度              │
├─ Rust 后端 ──────────────────────────────────────┤
│  DocumentPlugin · ImagePlugin · DataPlugin       │
│  WorkerPool · Pipeline · TempFileGuard           │
│  ShardedMap · validate_path · FileSniffer        │
└──────────────────────────────────────────────────┘
```

[完整架构文档 →](./docs/ARCHITECTURE.md)

---

## 🛠️ 开发

### 前置要求

- Node.js ≥ 20
- pnpm ≥ 9
- Rust ≥ 1.85
- Tauri v2 系统依赖 (见 [Tauri 文档](https://v2.tauri.app/start/prerequisites/))

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/QWQZhangErHao/format-conversion-factory.git
cd format-conversion-factory

# 安装依赖
pnpm install

# 开发模式（热重载）
cd apps/desktop && pnpm tauri dev

# 运行测试
pnpm test

# 生产构建
pnpm build
```

### 项目结构

```
format-conversion-factory/
├── apps/desktop/           # Tauri 桌面应用
│   ├── src/                # React 前端
│   └── src-tauri/          # Rust 后端
├── packages/
│   ├── core/               # 核心转换库
│   ├── ui-shared/          # 共享 UI 组件
│   └── utils/              # 工具函数
└── .github/workflows/      # CI/CD
```

---

## 🧪 测试

```bash
pnpm test                  # 运行所有测试
cd apps/desktop && pnpm test  # 前端测试 (36 tests)
cd packages/core && pnpm test  # 核心库测试 (266 tests)
```

---

## ⚠️ 已知局限

### 功能性限制

| 限制 | 原因 | 状态 |
|------|------|------|
| DOCX → 其他格式 | 浏览器端 ZIP+XML 文本提取，不支持保留样式/排版 | ⚠️ 有限支持 |
| WebP 有损编码 | `image` crate 0.25 只提供无损 API | 🔄 待升级 |
| PPTX/XLSX/PDF 解析 | 需额外的 Rust crate（网络不可用） | 📋 计划中 |
| 超大文件（>100MB） | 流式读取限制 10MB 校验，转换时全量读 | 🔄 待优化 |
| 部分图片格式（TIFF/AVIF/HEIC） | Rust `image` crate 需开启 feature | 📋 计划中 |

### 技术债

| 项目 | 阻塞项 | 计划 |
|------|--------|------|
| `ts-rs` TypeScript 类型生成 | 需 `cargo add ts-rs`（网络） | 已有离线替代 `types_export.rs` |
| `dashmap` 无锁并发哈希表 | 需 `cargo add dashmap`（网络） | 已有零依赖 `sharded_map.rs` |
| Wasm 动态插件 | 需 `cargo add wasmtime`（网络） | 接口已定义，待激活 |
| WebP 浏览器回退 | 无依赖 | `converters/webp-browser.ts` 已实现 |

### 已知 Bug

- **批量暂停按钮**：暂停状态会影响新任务启动，但已在执行的任务不会立即暂停（设计如此，非 Bug）
- **ETA 估算**：基于已完任务的平均耗时，首次估算可能不准确

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feat/amazing`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/amazing`)
5. 创建 Pull Request

请确保：
- 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范
- 所有测试通过 (`pnpm test`)
- 新功能包含对应测试

[贡献指南 →](./CONTRIBUTING.md)

---

## 📄 许可证

MIT License — 详见 [LICENSE](./LICENSE)

---

## 🙏 致谢

- [Tauri](https://tauri.app/) — 轻量级桌面框架
- [React](https://react.dev/) — UI 引擎
- [Framer Motion](https://www.framer.com/motion/) — 弹性动画
- [TailwindCSS](https://tailwindcss.com/) — 样式框架
- [pnpm](https://pnpm.io/) — 快速包管理器
- [Turbo](https://turbo.build/) — 构建编排

---

<div align="center">
  <sub>Built with ❤️ by QWQZhangErHao</sub>
</div>
