import { useState, useEffect } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%', padding: '11px 14px',
  border: '1px solid #e5e7eb', borderRadius: '10px',
  fontSize: '14px', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
  background: '#fff',
}

const labelStyle = {
  display: 'block', fontSize: '13px',
  fontWeight: 600, color: '#374151', marginBottom: '6px',
}

export default function LoginPage() {
  const { signIn, fetchProfile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')
  const [signupData, setSignupData] = useState({
    name: '', role: 'kid', avatarEmoji: '😊', avatarColor: '#6366f1',
  })

  const TAGLINES = [
    'Chores: the game where you actually get paid 💸',
    'Mom said clean your room. We made it fun. 🧹',
    'Earn credits. Buy freedom. 🎮',
    'Warning: side effects include a tidy room 😅',
    'Tasks done → credits earned → snacks unlocked 🍕',
    'The only app your parents AND you will love 🤝',
  ]
  const [taglineIdx, setTaglineIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTaglineIdx(i => (i + 1) % TAGLINES.length), 3200)
    return () => clearInterval(id)
  }, [])

  const EMOJIS = ['😊', '🦁', '🐼', '🦄', '🐸', '🌟', '🚀', '🦋', '🎮', '⚽', '🎨', '🎵']
  const COLORS = ['#6366f1', '#ec4899', '#f97316', '#22c55e', '#3b82f6', '#a855f7', '#14b8a6', '#f59e0b']

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) toast.error(error.message)
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!signupData.name.trim()) return toast.error('Please enter a name')
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { toast.error(error.message); setLoading(false); return }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        name: signupData.name.trim(),
        role: signupData.role,
        avatar_emoji: signupData.avatarEmoji,
        avatar_color: signupData.avatarColor,
      })
      if (profileError) { toast.error(profileError.message); setLoading(false); return }

      await fetchProfile(data.user.id)
      toast.success(`Welcome to Tasky, ${signupData.name}!`)
    } catch {
      toast.error('Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f5f5', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {/* Bouncing mascots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
            {['🧹', '🍽️', '🐕', '🌟', '🎮'].map((em, i) => (
              <span key={em} style={{
                fontSize: '26px', display: 'inline-block',
                animation: `bounce-fun 1.4s ease-in-out ${i * 0.18}s infinite`,
              }}>{em}</span>
            ))}
          </div>

          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: '#6366f1', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '30px', margin: '0 auto 16px',
          }}>
            ✅
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>Tasky</h1>

          {/* Rotating tagline */}
          <p
            key={taglineIdx}
            style={{
              fontSize: '13px', color: '#6366f1', marginTop: '6px',
              fontWeight: 600, animation: 'fade-up 0.4s ease both',
              minHeight: '20px',
            }}
          >
            {TAGLINES[taglineIdx]}
          </p>
          <p style={{ fontSize: '12px', color: '#c4b5fd', marginTop: '3px' }}>Sharabi Family</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: '18px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', padding: '8px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
            {[
              { id: 'login', label: 'Sign In' },
              { id: 'signup', label: 'Create Account' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  border: 'none',
                  background: mode === id ? '#fff' : 'transparent',
                  color: mode === id ? '#111827' : '#9ca3af',
                  boxShadow: mode === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={mode === 'login' ? handleLogin : handleSignup}
            style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {mode === 'signup' && (
              <>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    type="text"
                    value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    placeholder="Your name"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Role</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { value: 'parent', label: '👨‍👩‍👧 Parent', desc: 'Manage tasks & credits' },
                      { value: 'kid',    label: '🧒 Kid',           desc: 'Complete tasks & earn' },
                    ].map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setSignupData({ ...signupData, role: r.value })}
                        style={{
                          padding: '12px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer',
                          border: signupData.role === r.value ? '2px solid #6366f1' : '2px solid #e5e7eb',
                          background: signupData.role === r.value ? '#eef2ff' : '#fff',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{r.label}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Pick your avatar</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setSignupData({ ...signupData, avatarEmoji: em })}
                        style={{
                          width: '38px', height: '38px', borderRadius: '10px', fontSize: '20px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: signupData.avatarEmoji === em ? '2px solid #6366f1' : '2px solid transparent',
                          background: signupData.avatarEmoji === em ? '#eef2ff' : '#f9fafb',
                          cursor: 'pointer',
                          transform: signupData.avatarEmoji === em ? 'scale(1.1)' : 'scale(1)',
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSignupData({ ...signupData, avatarColor: c })}
                        style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: c, cursor: 'pointer', border: 'none',
                          outline: signupData.avatarColor === c ? `3px solid ${c}` : 'none',
                          outlineOffset: '2px',
                          transform: signupData.avatarColor === c ? 'scale(1.15)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '42px' }}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                    display: 'flex', padding: 0,
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                borderRadius: '10px', fontSize: '15px', fontWeight: 700,
                background: loading ? '#a5b4fc' : '#6366f1',
                color: '#fff', border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginTop: '4px',
              }}
            >
              {loading ? (
                <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <>
                  <LogIn size={17} />
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
