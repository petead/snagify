'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: 'implicit' } }
    )

    async function handleCallback() {
      // Read fragment (#) for implicit flow
      const hash   = window.location.hash.substring(1)
      const frag   = new URLSearchParams(hash)
      // Read query params for PKCE / token_hash flows
      const query  = new URLSearchParams(window.location.search)

      // ── Error from Supabase server ──
      const err = frag.get('error') || query.get('error')
      if (err) {
        const desc = frag.get('error_description') || query.get('error_description') || err
        router.replace(`/login?error=${encodeURIComponent(desc)}`)
        return
      }

      const type        = frag.get('type') || query.get('type')
      const accessToken = frag.get('access_token')
      const refreshToken = frag.get('refresh_token')
      const tokenHash   = query.get('token_hash')
      const code        = query.get('code')

      // ── Implicit flow (access_token in fragment) ──
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) { router.replace('/login?error=invalid_link'); return }
        router.replace(type === 'recovery' ? '/reset-password' : '/dashboard')
        return
      }

      // ── token_hash (OTP / confirm signup) ──
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'email' | 'recovery' | 'magiclink' | 'signup',
        })
        if (error) { router.replace('/login?error=invalid_link'); return }
        router.replace(type === 'recovery' ? '/reset-password' : '/dashboard')
        return
      }

      // ── PKCE code exchange ──
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { router.replace('/login?error=invalid_link'); return }
        router.replace(type === 'recovery' ? '/reset-password' : '/dashboard')
        return
      }

      // Fallback
      router.replace('/dashboard')
    }

    void handleCallback()
  }, [router])

  return (
    <div style={{
      minHeight: '100dvh', background: '#0A0812',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid rgba(154,136,253,0.2)',
        borderTopColor: '#9A88FD',
        animation: 'spin 0.7s linear infinite',
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
