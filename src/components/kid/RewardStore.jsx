import { useEffect, useState } from 'react'
import { Star, ShoppingBag, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sendPush } from '../../lib/notifications'

export default function RewardStore() {
  const { profile } = useAuth()
  const [rewards, setRewards] = useState([])
  const [balance, setBalance] = useState(0)
  const [redeeming, setRedeeming] = useState(null)
  const [redeemed, setRedeemed] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [rewardsRes, balanceRes, redemptionsRes] = await Promise.all([
      supabase.from('rewards').select('*').eq('is_active', true).order('cost'),
      supabase.from('kid_balances').select('balance').eq('id', profile.id).single(),
      supabase.from('redemptions').select('reward_id').eq('kid_id', profile.id),
    ])
    setRewards(rewardsRes.data || [])
    setBalance(balanceRes.data?.balance || 0)
    setRedeemed((redemptionsRes.data || []).map(r => r.reward_id))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRedeem(reward) {
    if (balance < reward.cost) return toast.error("Not enough credits!")
    if (redeeming) return
    setRedeeming(reward.id)

    // Deduct credits
    const { error } = await supabase.from('credit_ledger').insert({
      kid_id: profile.id,
      amount: -reward.cost,
      description: `Redeemed: ${reward.title}`,
      created_by: profile.id,
    })

    if (error) {
      toast.error('Something went wrong')
      setRedeeming(null)
      return
    }

    // Log redemption
    await supabase.from('redemptions').insert({
      kid_id: profile.id,
      kid_name: profile.name,
      reward_id: reward.id,
      reward_title: reward.title,
      reward_icon: reward.icon,
      reward_cost: reward.cost,
    })

    // Notify parents
    const { data: parents } = await supabase.from('profiles').select('id').eq('role', 'parent')
    if (parents?.length) {
      sendPush(
        parents.map(p => p.id),
        `${profile.name} redeemed a reward! ${reward.icon}`,
        `"${reward.title}" — ${reward.cost} credits`
      )
    }

    toast.success(`${reward.icon} Redeemed! Enjoy your reward!`)
    setRedeeming(null)
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '60px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const color = profile?.avatar_color || '#6366f1'

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
            const isRedeeming = redeeming === reward.id
            return (
              <div key={reward.id} style={{
                background: '#fff', borderRadius: '14px',
                border: `1px solid ${canAfford ? '#e5e7eb' : '#f3f4f6'}`,
                padding: '16px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                opacity: canAfford ? 1 : 0.6,
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                {/* Icon */}
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
                  background: canAfford ? color + '15' : '#f3f4f6',
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
                    {!canAfford && (
                      <span style={{ fontSize: '11px', color: '#ef4444', marginLeft: '4px' }}>
                        (need {reward.cost - balance} more)
                      </span>
                    )}
                  </div>
                </div>

                {/* Redeem button */}
                <button
                  onClick={() => handleRedeem(reward)}
                  disabled={!canAfford || isRedeeming}
                  style={{
                    padding: '9px 18px', borderRadius: '10px', flexShrink: 0,
                    fontSize: '13px', fontWeight: 700, border: 'none',
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    background: canAfford ? color : '#f3f4f6',
                    color: canAfford ? '#fff' : '#9ca3af',
                    transition: 'opacity 0.15s',
                    opacity: isRedeeming ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {isRedeeming ? '…' : <><CheckCircle size={14} /> Redeem</>}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Redemption history */}
      <RedemptionHistory kidId={profile.id} />
    </div>
  )
}

function RedemptionHistory({ kidId }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    supabase
      .from('redemptions')
      .select('*')
      .eq('kid_id', kidId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setHistory(data || []))
  }, [kidId])

  if (history.length === 0) return null

  return (
    <div style={{ marginTop: '32px' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px' }}>
        My redemptions
      </p>
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {history.map((r, i) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
            borderBottom: i < history.length - 1 ? '1px solid #f9fafb' : 'none',
          }}>
            <span style={{ fontSize: '20px' }}>{r.reward_icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{r.reward_title}</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Star size={11} fill="#f59e0b" color="#f59e0b" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>-{r.reward_cost}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
