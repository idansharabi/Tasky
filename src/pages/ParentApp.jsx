import { useState } from 'react'
import { LayoutDashboard, BookOpen, CalendarPlus, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ParentDashboard from '../components/parent/ParentDashboard'
import TaskBank from '../components/parent/TaskBank'
import TaskScheduler from '../components/parent/TaskScheduler'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'bank',      label: 'Task Bank',  icon: BookOpen },
  { id: 'schedule',  label: 'Schedule',   icon: CalendarPlus },
]

export default function ParentApp() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5', overflow: 'hidden' }}>

      {/* ── Dark Sidebar ── */}
      <aside className="hidden md:flex flex-col" style={{
        width: '220px', flexShrink: 0,
        background: '#111827', height: '100vh',
        borderRight: '1px solid #1f2937',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <span style={{ color: '#f9fafb', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.3px' }}>Tasky</span>
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
                fontSize: '14px', fontWeight: tab === id ? 500 : 400,
                background: tab === id ? '#1f2937' : 'transparent',
                color: tab === id ? '#f9fafb' : '#9ca3af',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (tab !== id) e.currentTarget.style.background = '#1f2937'; e.currentTarget.style.color = '#e5e7eb' }}
              onMouseLeave={e => { if (tab !== id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af' } }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ borderTop: '1px solid #1f2937', padding: '12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', marginBottom: '2px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: (profile?.avatar_color || '#6366f1') + '30',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            }}>
              {profile?.avatar_emoji || '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#f9fafb', fontSize: '14px', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.name}</p>
              <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>Parent</p>
            </div>
          </div>
          <button
            onClick={signOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#6b7280', background: 'transparent', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1f2937'; e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280' }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', background: '#ffffff' }}>

        {/* Top bar */}
        <header style={{
          height: '56px', flexShrink: 0,
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', padding: '0 32px',
          background: '#ffffff',
        }}>
          <button onClick={() => setMenuOpen(true)} className="md:hidden" style={{ marginRight: '12px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Menu size={18} />
          </button>
          <span style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>
            {NAV.find(n => n.id === tab)?.label}
          </span>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#fafafa' }}>
          {tab === 'dashboard' && <ParentDashboard onNavigate={setTab} />}
          {tab === 'bank'      && <TaskBank />}
          {tab === 'schedule'  && <TaskScheduler />}
        </main>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMenuOpen(false)} />
          <aside style={{ position: 'relative', width: '220px', background: '#111827', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1f2937' }}>
              <span style={{ color: '#f9fafb', fontWeight: 700 }}>Tasky</span>
              <button onClick={() => setMenuOpen(false)} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setTab(id); setMenuOpen(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    fontSize: '14px', background: tab === id ? '#1f2937' : 'transparent',
                    color: tab === id ? '#f9fafb' : '#9ca3af',
                  }}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </nav>
            <div style={{ borderTop: '1px solid #1f2937', padding: '12px 8px' }}>
              <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', width: '100%' }}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
