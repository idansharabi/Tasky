import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../shared/Modal'
import ConfirmDialog from '../shared/ConfirmDialog'

const ICONS = ['⭐', '🧹', '🍽️', '🛏️', '📚', '🐕', '🌱', '🏠', '🧺', '🚿', '🦷', '🥗', '🗑️', '🪣', '🧴', '📦', '🎒', '💪', '🎯', '🏆']

const DEFAULTS = [
  { title: 'Make your bed', icon: '🛏️', credit_value: 5, description: '' },
  { title: 'Do the dishes', icon: '🍽️', credit_value: 10, description: '' },
  { title: 'Clean your room', icon: '🧹', credit_value: 15, description: '' },
  { title: 'Take out the trash', icon: '🗑️', credit_value: 10, description: '' },
  { title: 'Homework done', icon: '📚', credit_value: 20, description: 'All assignments completed' },
  { title: 'Walk the dog', icon: '🐕', credit_value: 15, description: '' },
  { title: 'Set the table', icon: '🥗', credit_value: 5, description: '' },
  { title: 'Brush teeth (morning + night)', icon: '🦷', credit_value: 5, description: '' },
]

const inputStyle = {
  width: '100%', padding: '10px 14px',
  border: '1px solid #e5e7eb', borderRadius: '10px',
  fontSize: '14px', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
  background: '#fff',
}

const labelStyle = {
  display: 'block', fontSize: '13px',
  fontWeight: 600, color: '#374151', marginBottom: '6px',
}

export default function TaskBank() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', credit_value: 10, icon: '⭐' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('task_templates')
      .select('*')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => { load() }, [load])

  function openNew() {
    setForm({ title: '', description: '', credit_value: 10, icon: '⭐' })
    setModal('new')
  }

  function openEdit(tpl) {
    setForm({ title: tpl.title, description: tpl.description || '', credit_value: tpl.credit_value, icon: tpl.icon })
    setModal(tpl)
  }

  async function handleSeed() {
    setSaving(true)
    const rows = DEFAULTS.map((d) => ({ ...d, created_by: profile.id }))
    const { error } = await supabase.from('task_templates').insert(rows)
    if (!error) { toast.success('Default tasks added!'); load() }
    setSaving(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    setSaving(true)

    if (modal === 'new') {
      const { error } = await supabase.from('task_templates').insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        credit_value: Number(form.credit_value),
        icon: form.icon,
        created_by: profile.id,
      })
      if (!error) { toast.success('Task added to bank'); setModal(null); load() }
      else toast.error(error.message)
    } else {
      const { error } = await supabase.from('task_templates').update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        credit_value: Number(form.credit_value),
        icon: form.icon,
      }).eq('id', modal.id)
      if (!error) { toast.success('Task updated'); setModal(null); load() }
      else toast.error(error.message)
    }
    setSaving(false)
  }

  async function handleDelete() {
    const { error } = await supabase.from('task_templates').delete().eq('id', deleteTarget.id)
    if (!error) { toast.success('Task removed'); load() }
    setDeleteTarget(null)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 56px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.4px' }}>Task Bank</h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '4px 0 0' }}>Reusable tasks you can assign to kids</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {templates.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={saving}
              style={{
                padding: '9px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 500,
                border: '1px solid #e0e7ff', color: '#6366f1', background: '#f5f3ff',
                cursor: 'pointer',
              }}
            >
              Load defaults
            </button>
          )}
          <button
            onClick={openNew}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            <Plus size={15} /> New Task
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <div style={{ width: '28px', height: '28px', border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : templates.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 32px',
          background: '#fff', borderRadius: '16px',
          border: '2px dashed #e5e7eb',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: 0 }}>Your task bank is empty</p>
          <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '6px' }}>Add tasks or load the default set to get started</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
          {templates.map((tpl) => (
            <TaskRow key={tpl.id} tpl={tpl} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'new' ? 'New Task' : 'Edit Task'} onClose={() => setModal(null)} size="sm">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Icon</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setForm({ ...form, icon: ic })}
                    style={{
                      width: '38px', height: '38px', borderRadius: '10px', fontSize: '20px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: form.icon === ic ? '2px solid #6366f1' : '2px solid transparent',
                      background: form.icon === ic ? '#eef2ff' : '#f9fafb',
                      cursor: 'pointer',
                      transform: form.icon === ic ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Clean your room"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Description <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="More detail for the kid"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Credits</label>
              <input
                type="number"
                value={form.credit_value}
                onChange={(e) => setForm({ ...form, credit_value: e.target.value })}
                min="1" max="1000"
                style={inputStyle}
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%', padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                background: saving ? '#a5b4fc' : '#6366f1', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : modal === 'new' ? 'Add Task' : 'Save Changes'}
            </button>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Remove "${deleteTarget.title}" from the task bank?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Remove"
        />
      )}
    </div>
  )
}

function TaskRow({ tpl, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '16px 18px',
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #f3f4f6',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.07)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s',
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: '#f5f3ff', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '22px', flexShrink: 0,
      }}>
        {tpl.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.title}</p>
        {tpl.description && (
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.description}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
          <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>{tpl.credit_value} credits</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
        <button
          onClick={() => onEdit(tpl)}
          style={{ padding: '7px', borderRadius: '8px', border: 'none', background: '#f9fafb', cursor: 'pointer', color: '#6b7280', display: 'flex' }}
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(tpl)}
          style={{ padding: '7px', borderRadius: '8px', border: 'none', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex' }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
