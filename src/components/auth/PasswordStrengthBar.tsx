'use client'

import { motion } from 'framer-motion'
import { analyzePassword } from '@/lib/passwordStrength'

interface Props {
  password: string
}

export function PasswordStrengthBar({ password }: Props) {
  const analysis = analyzePassword(password)
  if (!password) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 space-y-2"
    >
      {/* Strength bar — 5 segments */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="h-1 flex-1 rounded-full"
            animate={{
              backgroundColor: i <= analysis.score ? analysis.color : '#E5E7EB'
            }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          />
        ))}
      </div>

      {/* Label */}
      <div className="flex justify-between items-center">
        <motion.span
          key={analysis.label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs font-semibold"
          style={{ color: analysis.color }}
        >
          {analysis.label}
        </motion.span>

        {/* Check indicators */}
        <div className="flex gap-2">
          {[
            { key: 'length', label: '8+' },
            { key: 'uppercase', label: 'A' },
            { key: 'number', label: '1' },
            { key: 'special', label: '!#' },
          ].map(({ key, label }) => (
            <motion.span
              key={key}
              animate={{
                color: analysis.checks[key as keyof typeof analysis.checks]
                  ? '#10B981'
                  : '#9CA3AF',
                scale: analysis.checks[key as keyof typeof analysis.checks] ? [1, 1.2, 1] : 1,
              }}
              transition={{ duration: 0.2 }}
              className="text-xs font-mono font-bold"
            >
              {label}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
