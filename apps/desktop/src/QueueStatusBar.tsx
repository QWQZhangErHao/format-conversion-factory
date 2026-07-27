import { motion } from 'framer-motion'
import { SPRING } from '../../../packages/ui-shared/src'

interface QueueStatusBarProps {
  totalFiles: number
  completedCount: number
  eta: number
  queuePaused: boolean
  files: { id: string; file: File; status: string }[]
  onTogglePause: () => void
}

export function QueueStatusBar({ totalFiles, completedCount, eta, queuePaused, files, onTogglePause }: QueueStatusBarProps) {
  const progress = totalFiles > 0 ? completedCount / totalFiles : 0
  const converting = files.filter(f => f.status === 'converting' || f.status === 'done' || f.status === 'error')

  return (
    <motion.section className="mt-5" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.GENTLE}>
      <div className="rounded-[14px] border border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-[12px] px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">批量转换</span>
            <span className="text-[12px] text-gray-400">{completedCount}/{totalFiles} 完成</span>
            {eta > 0 && (
              <span className="text-[12px] text-gray-400">
                预计剩余 {eta >= 60 ? `${Math.floor(eta / 60)}分${eta % 60}秒` : `${eta}秒`}
              </span>
            )}
          </div>
          <button
            onClick={onTogglePause}
            className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all ${queuePaused ? 'bg-[#34C759] text-white' : 'bg-orange-500 text-white'}`}
          >
            {queuePaused ? '▶ 恢复' : '⏸ 暂停'}
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#007AFF] to-[#5856D6]"
            initial={{ width: '0%' }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex gap-1.5 mt-2">
          {converting.map((cf) => (
            <div key={cf.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                cf.status === 'done' ? 'bg-[#34C759]' :
                cf.status === 'error' ? 'bg-[#FF3B30]' :
                cf.status === 'converting' ? 'bg-[#007AFF] animate-pulse' :
                queuePaused ? 'bg-orange-400' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              title={`${cf.file.name}: ${cf.status}`}
            />
          ))}
        </div>
      </div>
    </motion.section>
  )
}
