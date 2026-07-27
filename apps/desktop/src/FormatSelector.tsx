import { motion } from 'framer-motion'
import { GlassPanel, SegmentedControl, SPRING } from '../../../packages/ui-shared/src'
import { FORMAT_REGISTRY, FORMAT_BY_TAB, FORMAT_TABS, type FormatTab } from './format-registry'

interface FormatSelectorProps {
  activeTab: FormatTab
  selectedTarget: string | null
  onTabChange: (tab: FormatTab) => void
  onTargetChange: (format: string) => void
}

export function FormatSelector({ activeTab, selectedTarget, onTabChange, onTargetChange }: FormatSelectorProps) {
  return (
    <GlassPanel intensity="light" padding="md" rounded="xl">
      <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-4">目标格式</h3>
      <div className="flex justify-center mb-4">
        <SegmentedControl
          options={FORMAT_TABS}
          value={activeTab}
          onChange={(v: string) => { onTabChange(v as FormatTab) }}
        />
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
        {FORMAT_BY_TAB[activeTab].map((fmtId) => {
          const fmt = FORMAT_REGISTRY[fmtId]!
          return (
            <motion.button key={fmtId} onClick={() => onTargetChange(fmtId)}
              className={`rounded-[10px] py-3 text-center text-[13px] font-medium transition-all ${
                selectedTarget === fmtId
                  ? 'bg-[#007AFF] text-white shadow-md dark:bg-[#0A84FF]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={SPRING.SNAPPY}>
              {fmt.name}
            </motion.button>
          )
        })}
      </div>
    </GlassPanel>
  )
}
