'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Eye, EyeOff, ArrowRight, Loader2, Hash } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [otpLoading, setOtpLoading]     = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [forgotSent, setForgotSent]     = useState(false)
  const [otpSent, setOtpSent]           = useState(false)
  const [otpDigits, setOtpDigits]       = useState(['', '', '', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const otpCode = otpDigits.join('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message.includes('Invalid') ? 'Incorrect email or password.' : error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email above first.'); return }
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app.snagify.net/auth/callback',
    })
    if (resetError) { setError(resetError.message); return }
    setForgotSent(true)
  }

  async function handleSendOtp() {
    if (!email.trim() || !emailValid) { setError('Enter a valid email address first.'); return }
    setOtpLoading(true)
    setError(null)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    setOtpLoading(false)
    if (otpError) {
      setError(otpError.message.includes('not found') || otpError.message.includes('User')
        ? 'No account found with this email.'
        : otpError.message)
      return
    }
    setOtpDigits(['', '', '', '', '', '', '', ''])
    setOtpSent(true)
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }

  async function handleVerifyOtp() {
    if (otpCode.length < 8) return
    setVerifyLoading(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    })
    if (verifyError) {
      setError('Invalid or expired code. Please try again.')
      setVerifyLoading(false)
      setOtpDigits(['', '', '', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...otpDigits]
    newDigits[index] = digit
    setOtpDigits(newDigits)
    setError(null)
    if (digit && index < 7) {
      inputRefs.current[index + 1]?.focus()
    }
    if (newDigits.every(d => d !== '') && newDigits.join('').length === 8) {
      // Auto-submit when complete
      setTimeout(() => {
        setVerifyLoading(true)
        setError(null)
        supabase.auth.verifyOtp({ email, token: newDigits.join(''), type: 'email' })
          .then(({ error: verifyError }) => {
            if (verifyError) {
              setError('Invalid or expired code. Please try again.')
              setVerifyLoading(false)
              setOtpDigits(['', '', '', '', '', '', '', ''])
              setTimeout(() => inputRefs.current[0]?.focus(), 100)
              return
            }
            router.push('/dashboard')
            router.refresh()
          })
      }, 100)
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    if (!pasted) return
    const newDigits = [...otpDigits]
    pasted.split('').forEach((d, i) => { if (i < 8) newDigits[i] = d })
    setOtpDigits(newDigits)
    const nextEmpty = newDigits.findIndex(d => d === '')
    const focusIdx = nextEmpty === -1 ? 7 : nextEmpty
    inputRefs.current[focusIdx]?.focus()
  }

  // ── OTP code entry screen ──
  if (otpSent) {
    return (
      <div style={{ minHeight:'100dvh', background:'#0A0812', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 20px', position:'relative', overflow:'hidden' }}>
        <style>{`
          @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
          @keyframes drift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-15px)} }
          .otp-input { width:36px; height:50px; border-radius:12px; border:1.5px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white; font-size:18px; font-weight:700; text-align:center; font-family:Poppins,sans-serif; outline:none; transition:all 0.15s; caret-color:transparent; }
          .otp-input:focus { border-color:rgba(154,136,253,0.7); background:rgba(154,136,253,0.1); box-shadow:0 0 0 3px rgba(154,136,253,0.15); }
          .otp-input.filled { border-color:rgba(154,136,253,0.4); background:rgba(154,136,253,0.08); }
          .shimmer-btn { background:linear-gradient(90deg,#9A88FD 0%,#b8a9ff 40%,#9A88FD 100%); background-size:200% auto; animation:shimmer 2.5s linear infinite; }
          @keyframes spin { to{transform:rotate(360deg)} }
        `}</style>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
          <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(154,136,253,0.1) 0%, transparent 70%)', top:-100, left:'50%', transform:'translateX(-50%)', animation:'drift 18s ease-in-out infinite' }}/>
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize:'48px 48px' }}/>
        </div>

        <motion.div
          initial={{ opacity:0, y:24 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}
          style={{ width:'100%', maxWidth:400, position:'relative', zIndex:1 }}
        >
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:36 }}>
            <div style={{ width:40, height:40, borderRadius:12, overflow:'hidden', boxShadow:'0 0 20px rgba(154,136,253,0.4)', flexShrink:0 }}>
              <Image src="/icon-512x512.png" alt="Snagify" width={40} height={40} />
            </div>
            <span style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:22, color:'white', letterSpacing:'-0.3px' }}>Snagify</span>
          </div>

          <motion.div
            initial={{ opacity:0, y:16 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay:0.1 }}
            style={{ background:'linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))', border:'1px solid rgba(255,255,255,0.1)', borderRadius:28, padding:'36px 32px', boxShadow:'0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' }}
          >
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ width:56, height:56, borderRadius:18, background:'rgba(154,136,253,0.12)', border:'1px solid rgba(154,136,253,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <Hash size={24} color="#9A88FD" />
              </div>
              <h1 style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:22, color:'white', margin:'0 0 8px', letterSpacing:'-0.3px' }}>
                Enter your code
              </h1>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', margin:0, lineHeight:1.6 }}>
                We sent an 8-digit code to<br/>
                <span style={{ color:'#9A88FD', fontWeight:600 }}>{email}</span>
              </p>
            </div>

            {/* 8 digit inputs */}
            <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:20 }}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el }}
                  className={`otp-input${digit ? ' filled' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(i, e)}
                  onPaste={i === 0 ? handleDigitPaste : undefined}
                />
              ))}
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#FCA5A5', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              onClick={handleVerifyOtp}
              disabled={otpCode.length < 8 || verifyLoading}
              whileTap={{ scale:0.98 }}
              className={otpCode.length === 8 && !verifyLoading ? 'shimmer-btn' : ''}
              style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, color:'white', cursor:otpCode.length < 8 ? 'not-allowed' : 'pointer', opacity:otpCode.length < 8 ? 0.4 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:otpCode.length < 8 ? 'rgba(154,136,253,0.3)' : undefined, transition:'opacity 0.2s', boxSizing:'border-box' as const }}
            >
              {verifyLoading
                ? <Loader2 size={16} style={{ animation:'spin 0.8s linear infinite' }} />
                : <>Verify code <ArrowRight size={15} /></>
              }
            </motion.button>

            <div style={{ textAlign:'center', marginTop:20 }}>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtpDigits(['','','','','','','','']); setError(null) }}
                style={{ fontSize:12, color:'rgba(255,255,255,0.25)', background:'none', border:'none', cursor:'pointer' }}
              >
                ← Change email
              </button>
              <span style={{ color:'rgba(255,255,255,0.1)', margin:'0 10px' }}>·</span>
              <button
                type="button"
                onClick={handleSendOtp}
                style={{ fontSize:12, color:'rgba(154,136,253,0.7)', fontWeight:600, background:'none', border:'none', cursor:'pointer' }}
              >
                Resend code
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // ── Main login screen ──
  return (
    <div style={{ minHeight:'100dvh', background:'#0A0812', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 20px', position:'relative', overflow:'hidden' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes drift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-15px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .shimmer-btn { background:linear-gradient(90deg,#9A88FD 0%,#b8a9ff 40%,#9A88FD 100%); background-size:200% auto; animation:shimmer 2.5s linear infinite; }
        .input-field { width:100%; padding:13px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:14px; color:white; font-size:15px; font-family:'DM Sans',sans-serif; outline:none; transition:all 0.2s; box-sizing:border-box; }
        .input-field::placeholder { color:rgba(255,255,255,0.2); }
        .input-field:focus { border-color:rgba(154,136,253,0.6); background:rgba(154,136,253,0.08); box-shadow:0 0 0 3px rgba(154,136,253,0.12); }
        .input-field:-webkit-autofill { -webkit-box-shadow:0 0 0 1000px #130f24 inset; -webkit-text-fill-color:white; border-color:rgba(154,136,253,0.4); }
      `}</style>

      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(154,136,253,0.12) 0%, transparent 70%)', top:-100, left:'50%', transform:'translateX(-50%)', animation:'drift 18s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(202,254,135,0.06) 0%, transparent 70%)', bottom:-50, right:-50, animation:'drift 22s ease-in-out infinite reverse' }}/>
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize:'48px 48px' }}/>
      </div>

      <motion.div
        initial={{ opacity:0, y:28 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.5, ease:[0.16,1,0.3,1] }}
        style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity:0, scale:0.85 }}
          animate={{ opacity:1, scale:1 }}
          transition={{ delay:0.1, type:'spring', stiffness:300 }}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:36 }}
        >
          <div style={{ width:40, height:40, borderRadius:12, boxShadow:'0 0 20px rgba(154,136,253,0.4)', overflow:'hidden', flexShrink:0 }}>
            <Image src="/icon-512x512.png" alt="Snagify" width={40} height={40} />
          </div>
          <span style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:22, color:'white', letterSpacing:'-0.3px' }}>Snagify</span>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity:0, y:20 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.18 }}
          style={{ background:'linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:28, padding:'36px 32px', boxShadow:'0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' }}
        >
          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:26, color:'white', margin:'0 0 6px', letterSpacing:'-0.4px', lineHeight:1.2 }}>Sign in</h1>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', margin:0 }}>Welcome back to Snagify</p>
          </div>

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Email */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'1.2px', textTransform:'uppercase', marginBottom:8, fontFamily:'Poppins,sans-serif' }}>Email</label>
              <input className="input-field" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(null) }} placeholder="you@example.com" autoComplete="email"/>
            </div>

            {/* Password */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'1.2px', textTransform:'uppercase', fontFamily:'Poppins,sans-serif' }}>Password</label>
                <button type="button" onClick={handleForgotPassword} style={{ fontSize:12, fontWeight:600, color:'rgba(154,136,253,0.8)', background:'none', border:'none', cursor:'pointer' }}>Forgot?</button>
              </div>
              <div style={{ position:'relative' }}>
                <input className="input-field" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ paddingRight:44 }}/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', display:'flex', alignItems:'center' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {forgotSent && (
                <motion.div key="forgot" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  style={{ background:'rgba(202,254,135,0.1)', border:'1px solid rgba(202,254,135,0.2)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#CAFE87' }}>
                  Reset link sent — check your inbox.
                </motion.div>
              )}
              {error && (
                <motion.div key="error" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#FCA5A5', display:'flex', alignItems:'center', gap:8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button type="submit" disabled={loading || !email || !password} whileTap={{ scale:0.98 }}
              className={!loading && email && password ? 'shimmer-btn' : ''}
              style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, color:'white', cursor:loading || !email || !password ? 'not-allowed' : 'pointer', opacity:loading || !email || !password ? 0.4 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:loading || !email || !password ? 'rgba(154,136,253,0.3)' : undefined, transition:'opacity 0.2s', boxShadow:email && password ? '0 8px 28px rgba(154,136,253,0.3)' : 'none', boxSizing:'border-box' as const }}>
              {loading ? <Loader2 size={16} style={{ animation:'spin 0.8s linear infinite' }} /> : <>Sign in <ArrowRight size={15} /></>}
            </motion.button>
          </form>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:14, margin:'20px 0' }}>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.07)' }}/>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)', fontWeight:600, letterSpacing:'0.5px' }}>OR</span>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.07)' }}/>
          </div>

          {/* OTP button */}
          <motion.button type="button" onClick={handleSendOtp} disabled={otpLoading} whileTap={{ scale:0.98 }}
            style={{ width:'100%', padding:'13px', borderRadius:14, border:'1.5px dashed rgba(154,136,253,0.3)', background:'rgba(154,136,253,0.05)', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, color:'rgba(154,136,253,0.8)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s', opacity:otpLoading ? 0.6 : 1, boxSizing:'border-box' as const }}>
            {otpLoading ? <Loader2 size={14} style={{ animation:'spin 0.8s linear infinite' }} /> : <><Hash size={14} /> Send me an 8-digit code</>}
          </motion.button>
          <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.2)', margin:'8px 0 0' }}>No password needed · works great on mobile</p>
        </motion.div>

        <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.35 }}
          style={{ textAlign:'center', fontSize:13, color:'rgba(255,255,255,0.3)', marginTop:24 }}>
          No account yet?{' '}
          <Link href="/signup" style={{ color:'#9A88FD', fontWeight:700, textDecoration:'none' }}>Create one</Link>
        </motion.p>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
