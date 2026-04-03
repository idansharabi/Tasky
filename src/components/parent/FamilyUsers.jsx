import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Star, Shield, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function FamilyUsers() {
  const [users, setUsers] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [profilesRes, balancesRes] = await Promise.all([
        supabase.from('profiles_with_email').select('*').order('role').order('name'),
        supabase.from('kid_balances').select('id, balance'),
      ])
      setUsers(profilesRes.data || [])
      const bal = {}
      for (const k of (balancesRes.data || [])) bal[k.id] = k.balance
      setBalances(bal)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
      <div style={{ width: '28px', height: '28px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const parents = users.filter(u => u.role === 'parent')
  const kids    = users.filter(u => u.role === 'kid')

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '48px 40px 80px' }}>

      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>Family</h1>
        <p style={{ fontSize: '15px', color: '#9ca3af', marginTop: '6px' }}>{users.length} registered member{users.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Parents */}
      <Section title="Parents" icon={<Shield size={14} color="#6366f1" />} count={parents.length}>
        {parents.map((u, i) => (
          <UserRow key={u.id} user={u} isLast={i === parents.length - 1} />
        ))}
      </Section>

      {/* Kids */}
      <Section title="Kids" icon={<User size={14} color="#f59e0b" />} count={kids.length}>
        {kids.map((u, i) => (
          <UserRow key={u.id} user={u} isLast={i === kids.length - 1} balance={balances[u.id]} />
        ))}
      </Section>
    </div>
  )
}

function Section({ title, icon, count, children }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        {icon}
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
        <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '99px', fontWeight: 500 }}>{count}</span>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {children}
      </div>
    </div>
  )
}

function UserRow({ user, isLast, balance }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '16px 20px',
      borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
    }}>
      {/* Avatar */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
        background: (user.avatar_color || '#6366f1') + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
        border: `2px solid ${user.avatar_color || '#6366f1'}30`,
      }}>
        {user.avatar_emoji || '👤'}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: 0 }}>{user.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
          {user.email && (
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{user.email}</span>
          )}
          <span style={{ fontSize: '12px', color: '#d1d5db' }}>·</span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            Joined {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '—'}
          </span>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {balance != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fffbeb', padding: '4px 10px', borderRadius: '99px', border: '1px solid #fde68a' }}>
            <Star size={12} fill="#f59e0b" color="#f59e0b" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>{balance}</span>
          </div>
        )}
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px',
          background: user.role === 'parent' ? '#eef2ff' : '#f0fdf4',
          color: user.role === 'parent' ? '#4f46e5' : '#16a34a',
        }}>
          {user.role === 'parent' ? 'Parent' : 'Kid'}
        </span>
      </div>
    </div>
  )
}
