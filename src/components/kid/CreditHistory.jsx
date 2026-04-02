import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Star, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function CreditHistory() {
  const { profile } = useAuth()
  const [ledger, setLedger] = useState([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('kid_id', profile.id)
        .order('created_at', { ascending: false })
      setLedger(data || [])
      const total = (data || []).reduce((sum, r) => sum + r.amount, 0)
      setBalance(total)
      setLoading(false)
    }
    load()
  }, [profile.id])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div style={{ width: '28px', height: '28px', border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const earned = ledger.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)
  const spent = ledger.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '32px' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div style={{
          background: '#fff', borderRadius: '14px', border: '1px solid #f3f4f6',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '14px 12px', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
            <Star size={13} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{balance}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Balance</p>
        </div>

        <div style={{
          background: '#f0fdf4', borderRadius: '14px', border: '1px solid #bbf7d0',
          padding: '14px 12px', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
            <TrendingUp size={13} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>+{earned}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#4ade80', margin: 0 }}>Earned</p>
        </div>

        <div style={{
          background: '#fef2f2', borderRadius: '14px', border: '1px solid #fecaca',
          padding: '14px 12px', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
            <TrendingDown size={13} style={{ color: '#dc2626' }} />
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{spent}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#f87171', margin: 0 }}>Deducted</p>
        </div>
      </div>

      {/* Ledger entries */}
      {ledger.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '2px dashed #e5e7eb', padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>No history yet. Complete tasks to earn credits!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ledger.map((entry) => (
            <div key={entry.id} style={{
              background: '#fff', borderRadius: '12px',
              border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: entry.amount > 0 ? '#dcfce7' : '#fee2e2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {entry.amount > 0
                  ? <TrendingUp size={16} style={{ color: '#16a34a' }} />
                  : <TrendingDown size={16} style={{ color: '#dc2626' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>{format(new Date(entry.created_at), 'MMM d, yyyy · h:mm a')}</p>
              </div>
              <span style={{
                fontSize: '15px', fontWeight: 700, flexShrink: 0,
                color: entry.amount > 0 ? '#16a34a' : '#dc2626',
              }}>
                {entry.amount > 0 ? '+' : ''}{entry.amount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
