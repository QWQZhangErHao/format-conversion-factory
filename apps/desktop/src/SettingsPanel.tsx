import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel, SPRING } from '../../../packages/ui-shared/src'

interface SettingsPanelProps {
  visible: boolean
  quality: number
  aiEnabled: boolean
  onQualityChange: (v: number) => void
  onToggleAi: () => void
}

export function SettingsPanel({ visible, quality, aiEnabled, onQualityChange, onToggleAi }: SettingsPanelProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.section className="pt-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={SPRING.GENTLE}>
          <GlassPanel intensity="light" padding="md" rounded="xl">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-4">转换设置</h3>
            <div className="space-y-4">
              {/* Quality slider */}
              <div>
                <label className="flex justify-between text-[13px] text-gray-600 dark:text-gray-400 mb-2">
                  <span>输出质量</span><span>{quality}%</span>
                </label>
                <input type="range" min={10} max={100} value={quality} onChange={(e) => onQualityChange(Number(e.target.value))}
                  className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#007AFF]" />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1"><span>体积优先</span><span>质量优先</span></div>
              </div>

              {/* AI toggle */}
              <div className={`rounded-[12px] p-4 transition-all duration-300 ${
                aiEnabled ? 'bg-gradient-to-br from-[#5856D6]/10 via-[#007AFF]/5 to-transparent border border-[#5856D6]/20 dark:border-[#5856D6]/30' : 'bg-transparent'
              }`}>
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition-all ${
                      aiEnabled ? 'bg-gradient-to-br from-[#5856D6] to-[#007AFF] shadow-[0_0_16px_rgba(88,86,214,0.4)]' : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={aiEnabled ? 'white' : 'currentColor'} strokeWidth="1.5">
                        <path d="M12 2a4 4 0 014 4c0 2-2 4-2 4h-4s-2-2-2-4a4 4 0 014-4z" /><path d="M8 14h8v2a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2z" /><path d="M12 18v4" /><path d="M9 22h6" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[15px] text-gray-900 dark:text-white font-medium flex items-center gap-2">AI 增强转换</span>
                      <p className="text-[12px] text-gray-400 mt-0.5">{aiEnabled ? '使用本地 AI 模型优化转换质量' : '使用本地 AI 模型优化输出质量'}</p>
                    </div>
                  </div>
                  <div className={`relative w-12 h-7 rounded-full transition-all cursor-pointer ${aiEnabled ? 'bg-gradient-to-r from-[#5856D6] to-[#007AFF]' : 'bg-gray-300 dark:bg-gray-700'}`} onClick={onToggleAi}>
                    <motion.div className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md" animate={{ x: aiEnabled ? 22 : 0 }} transition={SPRING.SNAPPY} />
                  </div>
                </label>
              </div>
            </div>
          </GlassPanel>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
