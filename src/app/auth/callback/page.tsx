'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function handleCallback() {
      const query      = new URLSearchParams(window.location.search)
      const token_hash = query.get('token_hash')
      const type       = query.get('type') as 'email' | 'recovery' | 'magiclink' | 'signup' | null
      const code       = query.get('code')

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (error) { router.replace('/login'); return }
        router.replace(type === 'recovery' ? '/reset-password' : '/dashboard')
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { router.replace('/login'); return }
        router.replace('/dashboard')
        return
      }

      router.replace('/dashboard')
    }

    void handleCallback()
  }, [router])

  return (
    <div style={{ minHeight:'100dvh', background:'#0A0812', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:44, height:44, borderRadius:'50%', border:'3px solid rgba(154,136,253,0.2)', borderTopColor:'#9A88FD', animation:'spin 0.7s linear infinite' }}/>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )
}
