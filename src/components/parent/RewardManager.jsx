import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Star, Gift, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../shared/Modal'

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

export default function RewardManager() {
  const { profile } = useAuth()
  const [rewards, setRewards] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)   // null | 'new' | reward object
  const [form, setForm] = useState({ title: '', description: '', icon: '🎁', cost: 50 })
  const [seeding, setSeeding] = useState(false)

  async function load() {
    setLoading(true)
    const [rewardsRes, redemptionsRes] = await Promise.all([
      supabase.from('rewards').select('*').order('cost'),
      supabase.from('redemptions').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setRewards(rewardsRes.data || [])
    setRedemptions(redemptionsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('reward-manager-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'redemptions' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

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
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Reward Store
          </h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            Define rewards kids can redeem with their credits.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {rewards.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              style={{ fontSize: '13px', fontWeight: 600, padding: '9px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Gift size={14} /> {seeding ? 'Adding…' : 'Add Starter Rewards'}
            </button>
          )}
          <button
            onClick={openNew}
            style={{ fontSize: '13px', fontWeight: 600, padding: '9px 16px', borderRadius: '10px', border: 'none', background: '#6366f1', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> New Reward
          </button>
        </div>
      </div>

      {/* Rewards list */}
      <Section title="Rewards" count={rewards.length}>
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
                <div style={{ fontSize: '24px', width: '40px', textAlign: 'center', flexShrink: 0 }}>
                  {reward.icon}
                </div>
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

      {/* Redemptions */}
      {redemptions.length > 0 && (
        <Section title="Recent Redemptions" count={redemptions.length}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {redemptions.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px',
                borderBottom: i < redemptions.length - 1 ? '1px solid #f9fafb' : 'none',
              }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{r.reward_icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{r.reward_title}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
                    {r.kid_name} · {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  <Star size={11} fill="#f59e0b" color="#f59e0b" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>-{r.reward_cost}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Add / Edit modal */}
      {editItem && (
        <Modal title={editItem === 'new' ? 'New Reward' : 'Edit Reward'} onClose={() => setEditItem(null)} size="sm">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Emoji picker */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Icon</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} type="button" onClick={() => setForm(f => ({ ...f, icon: e }))}
                    style={{
                      width: '36px', height: '36px', borderRadius: '8px', fontSize: '18px',
                      border: form.icon === e ? '2px solid #6366f1' : '1px solid #e5e7eb',
                      background: form.icon === e ? '#eef2ff' : '#fff', cursor: 'pointer',
                    }}>
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

function Section({ title, count, children }) {
  return (
    <div style={{ marginBottom: '48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
        {count != null && (
          <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '99px', fontWeight: 500 }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}
