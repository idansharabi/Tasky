import { useState, useEffect } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%', padding: '11px 14px',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
  fontSize: '14px', color: '#e2e8f0',
  outline: 'none', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(4px)',
}

const labelStyle = {
  display: 'block', fontSize: '13px',
  fontWeight: 600, color: '#94a3b8', marginBottom: '6px',
}

export default function LoginPage() {
  const { signIn, fetchProfile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')
  const [signupData, setSignupData] = useState({
    name: '', role: 'kid', avatarEmoji: '😊', avatarColor: '#3b82f6',
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
  const COLORS = ['#3b82f6', '#6366f1', '#ec4899', '#f97316', '#22c55e', '#a855f7', '#14b8a6', '#f59e0b']

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
      padding: '24px', position: 'relative', overflow: 'hidden',
      background: '#060d1f',
    }}>
      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {/* Bouncing mascots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            {['🧹', '🍽️', '🐕', '🌟', '🎮'].map((em, i) => (
              <span key={em} style={{
                fontSize: '26px', display: 'inline-block',
                animation: `bounce-fun 1.4s ease-in-out ${i * 0.18}s infinite`,
                filter: 'drop-shadow(0 0 8px rgba(147,197,253,0.6))',
              }}>{em}</span>
            ))}
          </div>

          {/* Logo */}
          <div style={{
            width: '68px', height: '68px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            boxShadow: '0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '32px', margin: '0 auto 16px',
          }}>
            ✅
          </div>

          <h1 style={{
            fontSize: '32px', fontWeight: 800, margin: 0, letterSpacing: '-1px',
            background: 'linear-gradient(135deg, #93c5fd, #ffffff, #bfdbfe)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Tasky
          </h1>

          {/* Rotating tagline */}
          <p
            key={taglineIdx}
            style={{
              fontSize: '13px', color: '#60a5fa', marginTop: '8px',
              fontWeight: 500, animation: 'fade-up 0.4s ease both',
              minHeight: '20px',
            }}
          >
            {TAGLINES[taglineIdx]}
          </p>
          <p style={{ fontSize: '12px', color: '#334155', marginTop: '3px' }}>Sharabi Family</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(10, 20, 45, 0.75)',
          backdropFilter: 'blur(24px)',
          borderRadius: '20px',
          border: '1px solid rgba(59,130,246,0.2)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', padding: '8px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                  background: mode === id ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: mode === id ? '#93c5fd' : '#475569',
                  boxShadow: mode === id ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
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
                      { value: 'kid',    label: '🧒 Kid',    desc: 'Complete tasks & earn' },
                    ].map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setSignupData({ ...signupData, role: r.value })}
                        style={{
                          padding: '12px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer',
                          border: signupData.role === r.value ? '1.5px solid #3b82f6' : '1.5px solid rgba(255,255,255,0.08)',
                          background: signupData.role === r.value ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{r.label}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{r.desc}</div>
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
                          border: signupData.avatarEmoji === em ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.06)',
                          background: signupData.avatarEmoji === em ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
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
                          boxShadow: signupData.avatarColor === c ? `0 0 10px ${c}88` : 'none',
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
                    background: 'none', border: 'none', cursor: 'pointer', color: '#475569',
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
                width: '100%', padding: '13px',
                borderRadius: '10px', fontSize: '15px', fontWeight: 700,
                background: loading
                  ? 'rgba(59,130,246,0.4)'
                  : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                boxShadow: loading ? 'none' : '0 0 20px rgba(59,130,246,0.4)',
                color: '#fff', border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginTop: '4px', transition: 'all 0.2s',
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

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#1e3a5f' }}>
          ✨ Powered by stars and good behavior
        </p>
      </div>
    </div>
  )
}
