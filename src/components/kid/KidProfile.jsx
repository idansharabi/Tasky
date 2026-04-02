import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { Star, Flame, Trophy, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const LEVELS = [
  { min: 0,    label: 'Beginner',  emoji: '🌱', color: '#22c55e' },
  { min: 100,  label: 'Helper',    emoji: '🌟', color: '#f59e0b' },
  { min: 300,  label: 'Achiever',  emoji: '🏆', color: '#f97316' },
  { min: 600,  label: 'Champion',  emoji: '👑', color: '#a855f7' },
  { min: 1000, label: 'Legend',    emoji: '🚀', color: '#6366f1' },
]

function getLevel(balance) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (balance >= LEVELS[i].min) return { ...LEVELS[i], index: i }
  }
  return { ...LEVELS[0], index: 0 }
}

function getLevelProgress(balance) {
  const current = getLevel(balance)
  const next = LEVELS[current.index + 1]
  if (!next) return 100
  return Math.round(((balance - LEVELS[current.index].min) / (next.min - LEVELS[current.index].min)) * 100)
}

function calcStreak(approvedDates) {
  if (!approvedDates.length) return 0
  const unique = [...new Set(approvedDates)].sort().reverse()
  let streak = 0
  let check = format(new Date(), 'yyyy-MM-dd')
  for (const d of unique) {
    if (d === check) {
      streak++
      check = format(subDays(new Date(check + 'T00:00:00'), 1), 'yyyy-MM-dd')
    } else if (d < check) {
      break
    }
  }
  return streak
}

export default function KidProfile() {
  const { profile } = useAuth()
  const [balance, setBalance] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [streak, setStreak] = useState(0)
  const [tasksCompleted, setTasksCompleted] = useState(0)
  const [loading, setLoading] = useState(true)
  const color = profile?.avatar_color || '#6366f1'

  useEffect(() => {
    async function load() {
      const [ledgerRes, approvedRes] = await Promise.all([
        supabase.from('credit_ledger').select('amount').eq('kid_id', profile.id),
        supabase.from('task_assignments').select('due_date').eq('kid_id', profile.id).eq('status', 'approved'),
      ])
      const ledger = ledgerRes.data || []
      const bal = ledger.reduce((s, r) => s + r.amount, 0)
      const earned = ledger.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0)
      setBalance(bal)
      setTotalEarned(earned)

      const approved = approvedRes.data || []
      setTasksCompleted(approved.length)
      setStreak(calcStreak(approved.map(t => t.due_date)))
      setLoading(false)
    }
    load()
  }, [profile.id])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #e5e7eb', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const level = getLevel(balance)
  const nextLevel = LEVELS[level.index + 1]
  const progress = getLevelProgress(balance)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Hero card */}
      <div style={{
        background: '#fff', borderRadius: '20px',
        border: '1px solid #f3f4f6',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        padding: '28px 24px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: color + '20', margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px',
        }}>
          {profile?.avatar_emoji}
        </div>
        <p style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{profile?.name}</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: level.color + '15', padding: '4px 14px', borderRadius: '99px', marginTop: '6px' }}>
          <span style={{ fontSize: '16px' }}>{level.emoji}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: level.color }}>{level.label}</span>
        </div>

        {/* Level progress */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Level progress</span>
            {nextLevel ? (
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{balance} / {nextLevel.min} credits to {nextLevel.emoji} {nextLevel.label}</span>
            ) : (
              <span style={{ fontSize: '12px', color: level.color, fontWeight: 600 }}>Max level! 🎉</span>
            )}
          </div>
          <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: level.color, borderRadius: '99px', transition: 'width 0.8s ease' }} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <StatCard icon={<Star size={20} fill="#f59e0b" color="#f59e0b" />} label="Balance" value={balance} unit="credits" color="#f59e0b" />
        <StatCard icon={<TrendingUp size={20} color="#6366f1" />} label="Total earned" value={totalEarned} unit="credits" color="#6366f1" />
        <StatCard icon={<Flame size={20} color="#f97316" />} label="Streak" value={streak} unit={streak === 1 ? 'day' : 'days'} color="#f97316" />
        <StatCard icon={<Trophy size={20} color="#a855f7" />} label="Tasks done" value={tasksCompleted} unit="total" color="#a855f7" />
      </div>

      {/* All levels */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>All levels</p>
        </div>
        {LEVELS.map((lvl, i) => {
          const isCurrentLevel = level.index === i
          const isUnlocked = balance >= lvl.min
          return (
            <div key={lvl.label} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 20px',
              borderBottom: i < LEVELS.length - 1 ? '1px solid #f9fafb' : 'none',
              background: isCurrentLevel ? lvl.color + '08' : 'transparent',
            }}>
              <span style={{ fontSize: '22px', opacity: isUnlocked ? 1 : 0.3 }}>{lvl.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: isUnlocked ? '#111827' : '#9ca3af' }}>{lvl.label}</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{lvl.min}+ credits</p>
              </div>
              {isCurrentLevel && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: lvl.color, background: lvl.color + '15', padding: '3px 10px', borderRadius: '99px' }}>Current</span>
              )}
              {!isCurrentLevel && isUnlocked && (
                <span style={{ fontSize: '14px' }}>✓</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, unit, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '16px',
      border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      padding: '18px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        {icon}
        <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>{label}</span>
      </div>
      <p style={{ fontSize: '26px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>{unit}</p>
    </div>
  )
}
