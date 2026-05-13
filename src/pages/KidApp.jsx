import { useState } from 'react'
import { CheckSquare, ShoppingBag, Clock, User, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import KidDashboard from '../components/kid/KidDashboard'
import CreditHistory from '../components/kid/CreditHistory'
import KidProfile from '../components/kid/KidProfile'
import RewardStore from '../components/kid/RewardStore'
import ReleaseNotes from '../components/shared/ReleaseNotes'

const NAV = [
  { id: 'tasks',   label: 'My Tasks', icon: CheckSquare },
  { id: 'store',   label: 'Store',    icon: ShoppingBag },
  { id: 'history', label: 'History',  icon: Clock },
  { id: 'profile', label: 'Profile',  icon: User },
]

export default function KidApp() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('tasks')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const color = profile?.avatar_color || '#3b82f6'

  const SIDEBAR = {
    bg:           'rgba(6, 13, 31, 0.85)',
    border:       `rgba(${hexToRgb(color)}, 0.2)`,
    activeBg:     `rgba(${hexToRgb(color)}, 0.18)`,
    activeColor:  '#e2e8f0',
    inactiveColor:'#475569',
    hoverBg:      `rgba(${hexToRgb(color)}, 0.08)`,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'transparent', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col" style={{
        width: '220px', flexShrink: 0,
        background: SIDEBAR.bg,
        backdropFilter: 'blur(20px)',
        height: '100vh',
        borderRight: `1px solid ${SIDEBAR.border}`,
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${SIDEBAR.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', filter: `drop-shadow(0 0 6px ${color}99)` }}>✅</span>
            <span style={{
              fontWeight: 800, fontSize: '17px', letterSpacing: '-0.3px',
              background: `linear-gradient(135deg, ${color}, #fff)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Tasky</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: tab === id ? 600 : 400,
                background: tab === id ? SIDEBAR.activeBg : 'transparent',
                color: tab === id ? SIDEBAR.activeColor : SIDEBAR.inactiveColor,
                boxShadow: tab === id ? `inset 0 0 0 1px ${color}40` : 'none',
                transition: 'all 0.15s', textAlign: 'left',
              }}
              onMouseEnter={e => { if (tab !== id) { e.currentTarget.style.background = SIDEBAR.hoverBg; e.currentTarget.style.color = '#94a3b8' } }}
              onMouseLeave={e => { if (tab !== id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SIDEBAR.inactiveColor } }}
            >
              <Icon size={16} color={tab === id ? color : undefined} />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ borderTop: `1px solid ${SIDEBAR.border}`, padding: '12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', marginBottom: '2px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: color + '30',
              border: `1px solid ${color}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
              boxShadow: `0 0 10px ${color}40`,
            }}>
              {profile?.avatar_emoji || '🧒'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.name}</p>
              <p style={{ color: '#334155', fontSize: '12px', margin: 0 }}>Kid</p>
            </div>
          </div>
          <button
            onClick={signOut}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#475569', background: 'transparent', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' }}
          >
            <LogOut size={15} /> Sign out
          </button>
          <button
            onClick={() => setShowReleaseNotes(true)}
            style={{ width: '100%', fontSize: '11px', color: '#1e3a5f', textAlign: 'center', margin: '8px 0 0', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
            onMouseEnter={e => e.currentTarget.style.color = color}
            onMouseLeave={e => e.currentTarget.style.color = '#1e3a5f'}
          >
            v{__APP_VERSION__} · What's new
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>

        {/* Top bar */}
        <header style={{
          height: '56px', flexShrink: 0,
          borderBottom: `1px solid ${SIDEBAR.border}`,
          display: 'flex', alignItems: 'center', padding: '0 32px',
          background: 'rgba(6,13,31,0.7)',
          backdropFilter: 'blur(16px)',
        }}>
          <button onClick={() => setMenuOpen(true)} className="md:hidden" style={{ marginRight: '12px', color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Menu size={18} />
          </button>
          <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>
            {NAV.find(n => n.id === tab)?.label}
          </span>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', background: 'transparent' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 40px 80px', width: '100%', boxSizing: 'border-box' }}>
            {tab === 'tasks'   && <KidDashboard />}
            {tab === 'store'   && <RewardStore />}
            {tab === 'history' && <CreditHistory />}
            {tab === 'profile' && <KidProfile />}
          </div>
        </main>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={() => setMenuOpen(false)} />
          <aside style={{ position: 'relative', width: '220px', background: 'rgba(6,13,31,0.95)', backdropFilter: 'blur(20px)', borderRight: `1px solid ${SIDEBAR.border}`, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${SIDEBAR.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{profile?.avatar_emoji}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{profile?.name}</span>
              </div>
              <button onClick={() => setMenuOpen(false)} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setTab(id); setMenuOpen(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', background: tab === id ? SIDEBAR.activeBg : 'transparent', color: tab === id ? SIDEBAR.activeColor : SIDEBAR.inactiveColor }}>
                  <Icon size={16} color={tab === id ? color : undefined} /> {label}
                </button>
              ))}
            </nav>
            <div style={{ borderTop: `1px solid ${SIDEBAR.border}`, padding: '12px 8px' }}>
              <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', width: '100%' }}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {showReleaseNotes && <ReleaseNotes onClose={() => setShowReleaseNotes(false)} />}
    </div>
  )
}

// Helper: convert hex color to "r,g,b" string for rgba()
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}
