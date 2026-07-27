import { motion } from 'framer-motion'

const winctl = {
  minimize: async () => { try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().minimize() } catch { /* 非 Tauri 环境静默降级 */ } },
  toggleMaximize: async () => { try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().toggleMaximize() } catch { /* 非 Tauri 环境静默降级 */ } },
  close: async () => { try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().close() } catch { /* 非 Tauri 环境静默降级 */ } },
}

interface TitleBarProps {
  aiEnabled: boolean
  showLogs: boolean
  showSettings: boolean
  isDark: boolean
  onToggleLogs: () => void
  onToggleSettings: () => void
  onToggleDark: () => void
  onToggleAI?: () => void
}

export function TitleBar({ aiEnabled, showLogs, showSettings, onToggleLogs, onToggleSettings }: TitleBarProps) {
  return (
    <header className="titlebar sticky top-0 z-50 h-11 w-full flex items-center justify-between px-4 bg-white/60 dark:bg-gray-950/60 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
          <button onClick={winctl.close} className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF5F57] hover:brightness-110" title="关闭">
            <svg width="6" height="6" viewBox="0 0 10 10" fill="none" stroke="#4D0000" strokeWidth="1.5" className="opacity-0 group-hover:opacity-100"><path d="M2 2l6 6M8 2l-6 6"/></svg>
          </button>
          <button onClick={winctl.minimize} className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FEBC2E] hover:brightness-110" title="最小化">
            <svg width="6" height="6" viewBox="0 0 10 10" fill="none" stroke="#9A6B00" strokeWidth="1.5" className="opacity-0 group-hover:opacity-100"><path d="M2 5h6"/></svg>
          </button>
          <button onClick={winctl.toggleMaximize} className="group flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#28C840] hover:brightness-110" title="最大化">
            <svg width="6" height="6" viewBox="0 0 10 10" fill="none" stroke="#006400" strokeWidth="1.5" className="opacity-0 group-hover:opacity-100"><path d="M2 2h6v6H2z"/></svg>
          </button>
        </div>
        <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#007AFF] to-[#5856D6]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M4 17L10 11L14 15L20 9" /><path d="M20 9H15" /><path d="M20 9V4" /></svg>
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-gray-900 dark:text-white">格式转换工厂</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">v0.2</span>
      </div>
      <div className="flex items-center gap-1">
        {aiEnabled && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="flex items-center gap-1.5 mr-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#5856D6] to-[#007AFF] shadow-[0_0_12px_rgba(0,122,255,0.5)]">
            <motion.span className="w-1.5 h-1.5 rounded-full bg-white" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="text-[10px] font-semibold text-white tracking-wide">AI</span>
          </motion.div>
        )}
        <button onClick={onToggleLogs}
          className={`p-1.5 rounded-lg transition-all ${showLogs ? 'bg-[#5856D6]/10 text-[#5856D6]' : 'hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400'}`} title="日志">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
          </svg>
        </button>
        <button onClick={onToggleSettings}
          className={`p-1.5 rounded-lg transition-all ${showSettings ? 'bg-[#007AFF]/10 text-[#007AFF]' : 'hover:bg-gray-200/50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-300'}`} title="偏好设置">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </header>
  )
}
