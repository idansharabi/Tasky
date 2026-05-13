import { useState } from 'react'
import { LayoutDashboard, BookOpen, CalendarPlus, Users, ScrollText, LogOut, Menu, X, Gift } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ParentDashboard from '../components/parent/ParentDashboard'
import TaskBank from '../components/parent/TaskBank'
import TaskScheduler from '../components/parent/TaskScheduler'
import FamilyUsers from '../components/parent/FamilyUsers'
import AuditLog from '../components/parent/AuditLog'
import RewardManager from '../components/parent/RewardManager'
import ReleaseNotes from '../components/shared/ReleaseNotes'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bank',      label: 'Task Bank',  icon: BookOpen },
  { id: 'schedule',  label: 'Schedule',   icon: CalendarPlus },
  { id: 'rewards',   label: 'Rewards',    icon: Gift },
  { id: 'family',    label: 'Family',     icon: Users },
  { id: 'audit',     label: 'Audit Log',  icon: ScrollText },
]

const SIDEBAR = {
  bg:           'rgba(6, 13, 31, 0.85)',
  border:       'rgba(59,130,246,0.15)',
  activeBg:     'rgba(59,130,246,0.18)',
  activeColor:  '#93c5fd',
  inactiveColor:'#475569',
  hoverBg:      'rgba(59,130,246,0.08)',
}

export default function ParentApp() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)

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
            <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.8))' }}>✅</span>
            <span style={{
              fontWeight: 800, fontSize: '17px', letterSpacing: '-0.3px',
              background: 'linear-gradient(135deg, #93c5fd, #fff)',
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
                boxShadow: tab === id ? 'inset 0 0 0 1px rgba(59,130,246,0.25)' : 'none',
                transition: 'all 0.15s', textAlign: 'left',
              }}
              onMouseEnter={e => { if (tab !== id) { e.currentTarget.style.background = SIDEBAR.hoverBg; e.currentTarget.style.color = '#94a3b8' } }}
              onMouseLeave={e => { if (tab !== id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SIDEBAR.inactiveColor } }}
            >
              <Icon size={16} color={tab === id ? '#60a5fa' : undefined} />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ borderTop: `1px solid ${SIDEBAR.border}`, padding: '12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', marginBottom: '2px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: (profile?.avatar_color || '#3b82f6') + '30',
              border: `1px solid ${(profile?.avatar_color || '#3b82f6')}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            }}>
              {profile?.avatar_emoji || '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.name}</p>
              <p style={{ color: '#334155', fontSize: '12px', margin: 0 }}>Parent</p>
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
            onMouseEnter={e => e.currentTarget.style.color = '#60a5fa'}
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
          {tab === 'dashboard' && <ParentDashboard onNavigate={setTab} />}
          {tab === 'bank'      && <TaskBank />}
          {tab === 'schedule'  && <TaskScheduler />}
          {tab === 'rewards'   && <RewardManager />}
          {tab === 'family'    && <FamilyUsers />}
          {tab === 'audit'     && <AuditLog />}
        </main>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={() => setMenuOpen(false)} />
          <aside style={{ position: 'relative', width: '220px', background: 'rgba(6,13,31,0.95)', backdropFilter: 'blur(20px)', borderRight: `1px solid ${SIDEBAR.border}`, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${SIDEBAR.border}` }}>
              <span style={{ color: '#93c5fd', fontWeight: 700 }}>Tasky</span>
              <button onClick={() => setMenuOpen(false)} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setTab(id); setMenuOpen(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', background: tab === id ? SIDEBAR.activeBg : 'transparent', color: tab === id ? SIDEBAR.activeColor : SIDEBAR.inactiveColor }}>
                  <Icon size={16} /> {label}
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
