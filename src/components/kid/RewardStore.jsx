import { useEffect, useState } from 'react'
import { Star, ShoppingBag, Clock, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sendPush } from '../../lib/notifications'

export default function RewardStore() {
  const { profile } = useAuth()
  const [rewards, setRewards] = useState([])
  const [balance, setBalance] = useState(0)
  const [requesting, setRequesting] = useState(null)
  const [myRequests, setMyRequests] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [rewardsRes, balanceRes, requestsRes] = await Promise.all([
      supabase.from('rewards').select('*').eq('is_active', true).order('cost'),
      supabase.from('kid_balances').select('balance').eq('id', profile.id).single(),
      supabase.from('reward_requests').select('*').eq('kid_id', profile.id).order('created_at', { ascending: false }),
    ])
    setRewards(rewardsRes.data || [])
    setBalance(balanceRes.data?.balance || 0)
    setMyRequests(requestsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel(`reward-requests-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_requests', filter: `kid_id=eq.${profile.id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function handleRequest(reward) {
    if (balance < reward.cost) return toast.error("Not enough credits!")
    if (requesting) return
    setRequesting(reward.id)

    const { error } = await supabase.from('reward_requests').insert({
      kid_id: profile.id,
      kid_name: profile.name,
      reward_id: reward.id,
      reward_title: reward.title,
      reward_icon: reward.icon,
      reward_cost: reward.cost,
    })

    if (error) {
      toast.error('Something went wrong')
      setRequesting(null)
      return
    }

    // Notify parents
    const { data: parents } = await supabase.from('profiles').select('id').eq('role', 'parent')
    if (parents?.length) {
      sendPush(
        parents.map(p => p.id),
        `${profile.name} wants to redeem a reward! ${reward.icon}`,
        `"${reward.title}" — ${reward.cost} credits · Tap to approve`
      )
    }

    toast.success(`${reward.icon} Request sent! Waiting for parent approval…`)
    setRequesting(null)
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '60px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const color = profile?.avatar_color || '#6366f1'

  // Build a map of reward_id → latest request status
  const requestStatus = {}
  for (const r of myRequests) {
    if (!requestStatus[r.reward_id] || r.created_at > requestStatus[r.reward_id].created_at) {
      requestStatus[r.reward_id] = r
    }
  }

  return (
    <div>
      {/* Balance banner */}
      <div style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        borderRadius: '16px', padding: '20px 24px',
        marginBottom: '24px', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: '13px', margin: '0 0 4px', opacity: 0.85 }}>Your balance</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={20} fill="#fff" color="#fff" />
            <span style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>{balance}</span>
            <span style={{ fontSize: '14px', opacity: 0.85, marginTop: '4px' }}>credits</span>
          </div>
        </div>
        <ShoppingBag size={36} color="#fff" style={{ opacity: 0.3 }} />
      </div>

      {/* Rewards grid */}
      {rewards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: '32px', margin: '0 0 8px' }}>🏪</p>
          <p style={{ fontSize: '14px', margin: 0 }}>No rewards available yet — check back soon!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rewards.map(reward => {
            const canAfford = balance >= reward.cost
            const isRequesting = requesting === reward.id
            const req = requestStatus[reward.id]
            const isPending  = req?.status === 'pending'
            const isApproved = req?.status === 'approved'
            const isRejected = req?.status === 'rejected'

            return (
              <div key={reward.id} style={{
                background: '#fff', borderRadius: '14px',
                border: `1px solid ${isPending ? '#fde68a' : isApproved ? '#bbf7d0' : isRejected ? '#fecaca' : canAfford ? '#e5e7eb' : '#f3f4f6'}`,
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                opacity: canAfford || isPending || isApproved ? 1 : 0.6,
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                {/* Icon */}
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                  background: isApproved ? '#dcfce7' : isPending ? '#fef9c3' : canAfford ? color + '15' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px',
                }}>
                  {reward.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{reward.title}</p>
                  {reward.description && (
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 6px', lineHeight: 1.4 }}>{reward.description}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={12} fill="#f59e0b" color="#f59e0b" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: canAfford ? '#111827' : '#9ca3af' }}>
                      {reward.cost} credits
                    </span>
                    {!canAfford && !isPending && !isApproved && (
                      <span style={{ fontSize: '11px', color: '#ef4444', marginLeft: '4px' }}>
                        (need {reward.cost - balance} more)
                      </span>
                    )}
                  </div>
                </div>

                {/* Action button / status */}
                {isApproved ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '10px', background: '#dcfce7', flexShrink: 0 }}>
                    <CheckCircle size={14} color="#16a34a" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>Approved!</span>
                  </div>
                ) : isRejected ? (
                  <button
                    onClick={() => handleRequest(reward)}
                    disabled={!canAfford || isRequesting}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                      padding: '8px 12px', borderRadius: '10px', flexShrink: 0, border: 'none',
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      background: canAfford ? '#fef2f2' : '#f3f4f6',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <XCircle size={13} color="#ef4444" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>Rejected</span>
                    </div>
                    {canAfford && <span style={{ fontSize: '10px', color: '#9ca3af' }}>Try again?</span>}
                  </button>
                ) : isPending ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '10px', background: '#fef9c3', flexShrink: 0 }}>
                    <Clock size={14} color="#b45309" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#b45309' }}>Pending…</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleRequest(reward)}
                    disabled={!canAfford || isRequesting}
                    style={{
                      padding: '9px 18px', borderRadius: '10px', flexShrink: 0,
                      fontSize: '13px', fontWeight: 700, border: 'none',
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      background: canAfford ? color : '#f3f4f6',
                      color: canAfford ? '#fff' : '#9ca3af',
                      transition: 'opacity 0.15s',
                      opacity: isRequesting ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    {isRequesting ? '…' : '✋ Request'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Request history */}
      <RequestHistory requests={myRequests} />
    </div>
  )
}

function RequestHistory({ requests }) {
  if (requests.length === 0) return null

  const STATUS_LABEL = {
    pending:  { label: 'Pending',  color: '#b45309', bg: '#fef9c3' },
    approved: { label: 'Approved', color: '#15803d', bg: '#dcfce7' },
    rejected: { label: 'Rejected', color: '#b91c1c', bg: '#fee2e2' },
  }

  return (
    <div style={{ marginTop: '32px' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px' }}>
        My requests
      </p>
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {requests.slice(0, 10).map((r, i) => {
          const s = STATUS_LABEL[r.status] || STATUS_LABEL.pending
          return (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              borderBottom: i < Math.min(requests.length, 10) - 1 ? '1px solid #f9fafb' : 'none',
            }}>
              <span style={{ fontSize: '20px' }}>{r.reward_icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{r.reward_title}</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Star size={11} fill="#f59e0b" color="#f59e0b" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>{r.reward_cost}</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: s.bg, color: s.color }}>
                  {s.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
