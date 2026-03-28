'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [done, setDone]                 = useState(false)
  const [hasSession, setHasSession]     = useState(false)

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event (fired by callback page)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasSession(true)
      }
    })

    // Also check if session already exists (user arrived directly)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasSession(true)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }
    setDone(true)
    setTimeout(() => router.replace('/dashboard'), 2000)
  }

  if (!hasSession) return null

  return (
    <div style={{ minHeight:'100dvh', background:'#0A0812', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 20px', position:'relative', overflow:'hidden' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .shimmer-btn { background:linear-gradient(90deg,#9A88FD 0%,#b8a9ff 40%,#9A88FD 100%); background-size:200% auto; animation:shimmer 2.5s linear infinite; }
        .input-field { width:100%; padding:13px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:14px; color:white; font-size:15px; outline:none; transition:all 0.2s; box-sizing:border-box; }
        .input-field::placeholder { color:rgba(255,255,255,0.2); }
        .input-field:focus { border-color:rgba(154,136,253,0.6); background:rgba(154,136,253,0.08); box-shadow:0 0 0 3px rgba(154,136,253,0.12); }
        .input-field:-webkit-autofill { -webkit-box-shadow:0 0 0 1000px #130f24 inset; -webkit-text-fill-color:white; }
      `}</style>

      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(154,136,253,0.12) 0%, transparent 70%)', top:-100, left:'50%', transform:'translateX(-50%)' }}/>
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize:'48px 48px' }}/>
      </div>

      <motion.div
        initial={{ opacity:0, y:28 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.5, ease:[0.16,1,0.3,1] }}
        style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}
      >
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:36 }}>
          <div style={{ width:40, height:40, borderRadius:12, boxShadow:'0 0 20px rgba(154,136,253,0.4)', overflow:'hidden', flexShrink:0 }}>
            <Image src="/icon-512x512.png" alt="Snagify" width={40} height={40} />
          </div>
          <span style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:22, color:'white', letterSpacing:'-0.3px' }}>Snagify</span>
        </div>

        <div style={{ background:'linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))', border:'1px solid rgba(255,255,255,0.1)', borderRadius:28, padding:'36px 32px', boxShadow:'0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' }}>

          {done ? (
            <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} style={{ textAlign:'center', padding:'16px 0' }}>
              <div style={{ width:56, height:56, borderRadius:18, background:'rgba(202,254,135,0.12)', border:'1px solid rgba(202,254,135,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CAFE87" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:20, color:'white', margin:'0 0 8px' }}>Password updated</h2>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', margin:0 }}>Redirecting to your dashboard…</p>
            </motion.div>
          ) : (
            <>
              <div style={{ marginBottom:28 }}>
                <h1 style={{ fontFamily:'Poppins,sans-serif', fontWeight:800, fontSize:24, color:'white', margin:'0 0 6px', letterSpacing:'-0.3px' }}>New password</h1>
                <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', margin:0 }}>Choose a strong password for your account</p>
              </div>

              <form onSubmit={handleReset} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'1.2px', textTransform:'uppercase', marginBottom:8, fontFamily:'Poppins,sans-serif' }}>New password</label>
                  <div style={{ position:'relative' }}>
                    <input className="input-field" type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(null) }} placeholder="At least 8 characters" autoFocus style={{ paddingRight:44 }}/>
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', display:'flex', alignItems:'center' }}>
                      {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'1.2px', textTransform:'uppercase', marginBottom:8, fontFamily:'Poppins,sans-serif' }}>Confirm password</label>
                  <input className="input-field" type={showPassword ? 'text' : 'password'} value={confirm} onChange={e => { setConfirm(e.target.value); setError(null) }} placeholder="Same password again"/>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                      style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:'10px 14px', fontSize:13, color:'#FCA5A5', display:'flex', alignItems:'center', gap:8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button type="submit" disabled={loading || !password || !confirm} whileTap={{ scale:0.98 }}
                  className={!loading && password && confirm ? 'shimmer-btn' : ''}
                  style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:14, color:'white', cursor:loading || !password || !confirm ? 'not-allowed' : 'pointer', opacity:loading || !password || !confirm ? 0.4 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:loading || !password || !confirm ? 'rgba(154,136,253,0.3)' : undefined, boxSizing:'border-box' as const }}>
                  {loading ? <Loader2 size={16} style={{ animation:'spin 0.8s linear infinite' }}/> : <>Update password <ArrowRight size={15}/></>}
                </motion.button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
