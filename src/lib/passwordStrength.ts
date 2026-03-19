export type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong'

export interface PasswordAnalysis {
  strength: PasswordStrength
  score: number
  label: string
  color: string
  bgColor: string
  checks: {
    length: boolean
    uppercase: boolean
    lowercase: boolean
    number: boolean
    special: boolean
  }
}

export function analyzePassword(password: string): PasswordAnalysis {
  if (!password) return {
    strength: 'empty',
    score: 0,
    label: '',
    color: '#E5E7EB',
    bgColor: '#F9FAFB',
    checks: { length: false, uppercase: false, lowercase: false, number: false, special: false }
  }

  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }

  const score = Object.values(checks).filter(Boolean).length

  const map: Record<number, Omit<PasswordAnalysis, 'score' | 'checks'>> = {
    0: { strength: 'weak',   label: 'Too short',  color: '#EF4444', bgColor: '#FEE2E2' },
    1: { strength: 'weak',   label: 'Weak',       color: '#EF4444', bgColor: '#FEE2E2' },
    2: { strength: 'fair',   label: 'Fair',       color: '#F59E0B', bgColor: '#FEF3C7' },
    3: { strength: 'good',   label: 'Good',       color: '#9A88FD', bgColor: '#EDE9FF' },
    4: { strength: 'good',   label: 'Good',       color: '#9A88FD', bgColor: '#EDE9FF' },
    5: { strength: 'strong', label: 'Strong 💪',  color: '#10B981', bgColor: '#D1FAE5' },
  }

  return { ...map[score], score, checks }
}
