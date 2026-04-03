import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const ACTION_STYLE = {
  'Task assigned':     { bg: '#eef2ff', color: '#4f46e5', dot: '#6366f1' },
  'Task approved':     { bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
  'Task rejected':     { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  'Task submitted':    { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
  'Task auto-approved':{ bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
  'Task removed':      { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  'Credits added':     { bg: '#fffbeb', color: '#d97706', dot: '#f59e0b' },
  'Credits deducted':  { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
}

const DEFAULT_STYLE = { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' }

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('audit-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  const roles = ['all', 'parent', 'kid']
  const filtered = filter === 'all' ? logs : logs.filter(l => l.user_role === filter)

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 40px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>Audit Log</h1>
          <p style={{ fontSize: '15px', color: '#9ca3af', marginTop: '6px' }}>{filtered.length} event{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Role filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
        {roles.map(r => (
          <button key={r} onClick={() => setFilter(r)} style={{
            padding: '6px 16px', borderRadius: '99px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
            background: filter === r ? '#111827' : '#f3f4f6',
            color: filter === r ? '#fff' : '#6b7280',
            transition: 'all 0.15s',
          }}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: '28px', height: '28px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: '14px', padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>No events yet. Actions will appear here as they happen.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {filtered.map((log, i) => {
            const s = ACTION_STYLE[log.action] || DEFAULT_STYLE
            return (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                {/* Dot */}
                <div style={{ marginTop: '6px', width: '8px', height: '8px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{log.user_name}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px',
                      background: s.bg, color: s.color,
                    }}>
                      {log.action}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9ca3af', background: log.user_role === 'parent' ? '#eef2ff' : '#f0fdf4', padding: '2px 7px', borderRadius: '99px', color: log.user_role === 'parent' ? '#4f46e5' : '#16a34a', fontWeight: 500 }}>
                      {log.user_role}
                    </span>
                  </div>
                  {log.details && (
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '3px 0 0' }}>{log.details}</p>
                  )}
                </div>

                {/* Time */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                    {format(new Date(log.created_at), 'MMM d, HH:mm')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
