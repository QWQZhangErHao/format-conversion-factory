import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// Resolve @tauri-apps/api from the desktop app's node_modules
const tauriApiResolved = path.resolve(__dirname, 'node_modules/@tauri-apps/api')

// https://v2.tauri.app/start/frontend/vite/
const config = async () => {
  const host = process.env.TAURI_DEV_HOST

  return {
    plugins: [tailwindcss(), react(), tauriCompatibilityPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // Stub optional AI packages (loaded dynamically, may not be installed)
        'onnxruntime-web': path.resolve(__dirname, '../../packages/core/src/test/tauri-stub.ts'),
        '@mlc-ai/web-llm': path.resolve(__dirname, '../../packages/core/src/test/tauri-stub.ts'),
        // Tauri APIs: resolve from real package
        '@tauri-apps/api/core': path.resolve(tauriApiResolved, 'core.js'),
        '@tauri-apps/api/event': path.resolve(tauriApiResolved, 'event.js'),
        '@tauri-apps/api/window': path.resolve(tauriApiResolved, 'window.js'),
      },
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: 'ws',
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-motion': ['framer-motion'],
          },
        },
      },
    },
  }
}
export default config

// Plugin to remove crossorigin from built HTML for Tauri compatibility
function tauriCompatibilityPlugin() {
  return {
    name: 'tauri-compat',
    enforce: 'post' as const,
    transformIndexHtml(html: string) {
      return html.replace(/crossorigin\s*/g, '')
    }
  }
}
