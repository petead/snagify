'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    })
    
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h1>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm mb-4">
            {error}
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
            placeholder="you@example.com"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
            placeholder="••••••••"
          />
        </div>
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#9A88FD] text-white font-semibold py-3 rounded-xl"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        
        <p className="text-center text-sm text-gray-500 mt-4">
          No account?{' '}
          <a href="/register" className="text-[#9A88FD] font-medium">Register</a>
        </p>
      </div>
    </div>
  )
}
