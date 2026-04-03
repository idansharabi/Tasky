import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import KidDashboard from '../components/kid/KidDashboard'
import CreditHistory from '../components/kid/CreditHistory'
import KidProfile from '../components/kid/KidProfile'

const TABS = [
  { id: 'tasks',   label: 'My Tasks',  icon: '✅' },
  { id: 'history', label: 'History',   icon: '📜' },
  { id: 'profile', label: 'Profile',   icon: '🏆' },
]

export default function KidApp() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('tasks')
  const color = profile?.avatar_color || '#6366f1'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {/* Top row */}
        <div style={{
          maxWidth: '600px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
              background: color + '25',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
            }}>
              {profile?.avatar_emoji}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '15px', color: '#111827', margin: 0, lineHeight: 1.2 }}>{profile?.name}</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>✅ Tasky <span style={{ fontSize: '10px', color: '#d1d5db' }}>v{__APP_VERSION__}</span></p>
            </div>
          </div>
          <button
            onClick={signOut}
            style={{ padding: '8px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          maxWidth: '600px', margin: '0 auto',
          display: 'flex', gap: '6px', padding: '0 20px 12px',
        }}>
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '20px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: tab === id ? color : '#f3f4f6',
                color: tab === id ? '#fff' : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: '600px', margin: '0 auto', width: '100%', padding: '20px 20px 40px' }}>
        {tab === 'tasks'   && <KidDashboard />}
        {tab === 'history' && <CreditHistory />}
        {tab === 'profile' && <KidProfile />}
      </main>
    </div>
  )
}
