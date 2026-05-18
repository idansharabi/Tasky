import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Star, Gift, ToggleLeft, ToggleRight, CheckCircle, XCircle, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../shared/Modal'
import { sendPush } from '../../lib/notifications'
import { logAction } from '../../lib/audit'

const DEFAULT_REWARDS = [
  { title: 'Extra Screen Time', description: '30 minutes of extra screen time', icon: '📱', cost: 50 },
  { title: 'Choose Dinner', description: 'Pick what the family eats tonight', icon: '🍕', cost: 80 },
  { title: 'Stay Up Late', description: '30 extra minutes before bedtime', icon: '🌙', cost: 60 },
  { title: 'Movie Night Pick', description: 'Choose the family movie this week', icon: '🎬', cost: 100 },
  { title: 'Skip a Chore', description: 'Skip one assigned chore this week', icon: '🙈', cost: 120 },
  { title: 'Small Treat', description: 'Choose a snack or small treat', icon: '🍦', cost: 40 },
  { title: 'Friend Sleepover', description: 'Invite a friend for a sleepover', icon: '🛏️', cost: 200 },
  { title: 'Toy / Game', description: 'A small toy or game of your choice', icon: '🎮', cost: 300 },
]

const EMOJI_OPTIONS = ['🎁','🍕','📱','🌙','🎬','🙈','🍦','🎮','🛏️','🎯','🏆','🎨','🚀','⭐','💎','🎪','🎠','🎡']

const MEDALS = ['🥇', '🥈', '🥉']

export default function RewardManager() {
  const { profile } = useAuth()
  const [rewards, setRewards] = useState([])
  const [requests, setRequests] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', icon: '🎁', cost: 50 })
  const [seeding, setSeeding] = useState(false)
  const [actioning, setActioning] = useState(null)

  async function load() {
    setLoading(true)
    const [rewardsRes, requestsRes, lbRes] = await Promise.all([
      supabase.from('rewards').select('*').order('cost'),
      supabase.from('reward_requests').select('*').eq('status', 'pending').order('created_at'),
      supabase.rpc('get_leaderboard'),
    ])
    setRewards(rewardsRes.data || [])
    setRequests(requestsRes.data || [])
    setLeaderboard(lbRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('reward-manager-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_requests' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'credit_ledger' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function handleApprove(req) {
    if (actioning) return
    setActioning(req.id)
    try {
      // Deduct credits
      const { error: ledgerErr } = await supabase.from('credit_ledger').insert({
        kid_id: req.kid_id,
        amount: -req.reward_cost,
        description: `Redeemed: ${req.reward_title}`,
        created_by: profile.id,
      })
      if (ledgerErr) throw ledgerErr

      // Log redemption
      await supabase.from('redemptions').insert({
        kid_id: req.kid_id,
        kid_name: req.kid_name,
        reward_id: req.reward_id,
        reward_title: req.reward_title,
        reward_icon: req.reward_icon,
        reward_cost: req.reward_cost,
      })

      // Mark request approved
      await supabase.from('reward_requests').update({ status: 'approved' }).eq('id', req.id)

      // Notify kid
      sendPush([req.kid_id], `${req.reward_icon} Request approved!`, `"${req.reward_title}" is yours — enjoy! 🎉`)

      logAction(profile, 'Reward approved', 'reward', `${req.reward_icon} "${req.reward_title}" for ${req.kid_name}`)
      toast.success(`✅ Approved! ${req.reward_cost} credits deducted from ${req.kid_name}`)
      load()
    } catch (e) {
      toast.error(e.message || 'Something went wrong')
    }
    setActioning(null)
  }

  async function handleReject(req) {
    if (actioning) return
    setActioning(req.id)
    await supabase.from('reward_requests').update({ status: 'rejected' }).eq('id', req.id)
    sendPush([req.kid_id], `${req.reward_icon} Request declined`, `"${req.reward_title}" wasn't approved this time`)
    logAction(profile, 'Reward rejected', 'reward', `${req.reward_icon} "${req.reward_title}" for ${req.kid_name}`)
    toast(`Rejected ${req.reward_icon}`)
    setActioning(null)
    load()
  }

  async function handleSeed() {
    setSeeding(true)
    const rows = DEFAULT_REWARDS.map(r => ({ ...r, created_by: profile.id }))
    await supabase.from('rewards').insert(rows)
    toast.success(`Added ${rows.length} starter rewards!`)
    setSeeding(false)
    load()
  }

  function openNew() {
    setForm({ title: '', description: '', icon: '🎁', cost: 50 })
    setEditItem('new')
  }

  function openEdit(reward) {
    setForm({ title: reward.title, description: reward.description || '', icon: reward.icon, cost: reward.cost })
    setEditItem(reward)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    if (editItem === 'new') {
      await supabase.from('rewards').insert({ ...form, created_by: profile.id })
      toast.success('Reward added!')
    } else {
      await supabase.from('rewards').update(form).eq('id', editItem.id)
      toast.success('Reward updated!')
    }
    setEditItem(null)
    load()
  }

  async function handleToggle(reward) {
    await supabase.from('rewards').update({ is_active: !reward.is_active }).eq('id', reward.id)
    load()
  }

  async function handleDelete(reward) {
    if (!confirm(`Delete "${reward.title}"?`)) return
    await supabase.from('rewards').delete().eq('id', reward.id)
    toast.success('Reward deleted')
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
      <div style={{ width: '28px', height: '28px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 56px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Rewards
          </h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            Manage rewards and approve kid requests.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {rewards.length === 0 && (
            <button onClick={handleSeed} disabled={seeding}
              style={{ fontSize: '13px', fontWeight: 600, padding: '9px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Gift size={14} /> {seeding ? 'Adding…' : 'Add Starter Rewards'}
            </button>
          )}
          <button onClick={openNew}
            style={{ fontSize: '13px', fontWeight: 600, padding: '9px 16px', borderRadius: '10px', border: 'none', background: '#6366f1', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> New Reward
          </button>
        </div>
      </div>

      {/* ── Pending Requests ── */}
      {requests.length > 0 && (
        <Section title="Pending Requests" count={requests.length} accent="#f59e0b">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requests.map(req => (
              <div key={req.id} style={{
                background: '#fff', borderRadius: '14px',
                border: '1px solid #fde68a',
                padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: '14px',
                boxShadow: '0 1px 4px rgba(245,158,11,0.1)',
              }}>
                <div style={{ fontSize: '28px', flexShrink: 0 }}>{req.reward_icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>{req.reward_title}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                    {req.kid_name} · {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <Star size={13} fill="#f59e0b" color="#f59e0b" />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{req.reward_cost}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleApprove(req)}
                    disabled={actioning === req.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    disabled={actioning === req.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Leaderboard ── */}
      {leaderboard.length > 0 && (
        <Section title="This Week's Leaderboard" icon={<Trophy size={15} color="#f59e0b" />}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden' }}>
            {leaderboard.map((kid, i) => (
              <div key={kid.kid_id} style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px',
                borderBottom: i < leaderboard.length - 1 ? '1px solid #f3f4f6' : 'none',
                background: i === 0 ? '#fffbeb' : '#fff',
              }}>
                <span style={{ fontSize: '20px', width: '28px', textAlign: 'center', flexShrink: 0 }}>
                  {MEDALS[i] || `${i + 1}`}
                </span>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                  background: (kid.avatar_color || '#6366f1') + '25',
                  border: `2px solid ${kid.avatar_color || '#6366f1'}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                }}>
                  {kid.avatar_emoji}
                </div>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#111827' }}>{kid.name}</span>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                    <Star size={12} fill="#f59e0b" color="#f59e0b" />
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>{kid.credits_this_week}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>this week</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Rewards list ── */}
      <Section title="Reward Store" count={rewards.length}>
        {rewards.length === 0 ? (
          <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: '14px', padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '32px', margin: '0 0 8px' }}>🎁</p>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 20px' }}>No rewards yet. Add starter rewards or create your own.</p>
            <button onClick={handleSeed} disabled={seeding}
              style={{ fontSize: '13px', fontWeight: 600, padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#6366f1', cursor: 'pointer', color: '#fff' }}>
              {seeding ? 'Adding…' : '✨ Add Starter Rewards'}
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {rewards.map((reward, i) => (
              <div key={reward.id} style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px',
                borderBottom: i < rewards.length - 1 ? '1px solid #f3f4f6' : 'none',
                opacity: reward.is_active ? 1 : 0.5,
              }}>
                <div style={{ fontSize: '24px', width: '40px', textAlign: 'center', flexShrink: 0 }}>{reward.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{reward.title}</p>
                  {reward.description && (
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>{reward.description}</p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <Star size={12} fill="#f59e0b" color="#f59e0b" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{reward.cost}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => handleToggle(reward)} title={reward.is_active ? 'Disable' : 'Enable'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: reward.is_active ? '#16a34a' : '#9ca3af', padding: '4px' }}>
                    {reward.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => openEdit(reward)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(reward)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Add / Edit modal */}
      {editItem && (
        <Modal title={editItem === 'new' ? 'New Reward' : 'Edit Reward'} onClose={() => setEditItem(null)} size="sm">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Icon</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} type="button" onClick={() => setForm(f => ({ ...f, icon: e }))}
                    style={{ width: '36px', height: '36px', borderRadius: '8px', fontSize: '18px', border: form.icon === e ? '2px solid #6366f1' : '1px solid #e5e7eb', background: form.icon === e ? '#eef2ff' : '#fff', cursor: 'pointer' }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. Movie Night Pick"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Description <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Choose the family movie this week"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Cost (credits)</label>
              <input type="number" min="1" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: parseInt(e.target.value) || 0 }))} required
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit"
              style={{ padding: '10px', background: '#6366f1', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              {editItem === 'new' ? 'Add Reward' : 'Save Changes'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Section({ title, count, accent, icon, children }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        {icon}
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{title}</h2>
        {count != null && (
          <span style={{
            fontSize: '12px', color: accent ? '#fff' : '#6b7280',
            background: accent || '#f3f4f6',
            padding: '2px 8px', borderRadius: '99px', fontWeight: 600,
          }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}
