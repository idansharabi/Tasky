import { useState } from 'react'
import { CheckCircle, Clock, AlertCircle, XCircle, Camera, Star } from 'lucide-react'

function formatTimeLabel(t) {
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  if (h === 0)  return `12:${mStr} AM`
  if (h === 12) return `12:${mStr} PM`
  return h < 12 ? `${h}:${mStr} AM` : `${h - 12}:${mStr} PM`
}

const STATUS_CONFIG = {
  pending: {
    bg: '#fff',
    border: '#f3f4f6',
    badgeBg: '#f3f4f6',
    badgeColor: '#6b7280',
    badgeLabel: 'To Do',
    icon: Clock,
    iconColor: '#d1d5db',
  },
  submitted: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    badgeBg: '#dbeafe',
    badgeColor: '#2563eb',
    badgeLabel: 'Waiting…',
    icon: AlertCircle,
    iconColor: '#3b82f6',
  },
  approved: {
    bg: '#f0fdf4',
    border: '#bbf7d0',
    badgeBg: '#dcfce7',
    badgeColor: '#16a34a',
    badgeLabel: 'Done ✓',
    icon: CheckCircle,
    iconColor: '#22c55e',
  },
  rejected: {
    bg: '#fef2f2',
    border: '#fecaca',
    badgeBg: '#fee2e2',
    badgeColor: '#dc2626',
    badgeLabel: 'Redo',
    icon: XCircle,
    iconColor: '#ef4444',
  },
}

export default function TaskCard({ task, onSubmit }) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
  const StatusIcon = config.icon
  const canSubmit = task.status === 'pending' || task.status === 'rejected'
  const [pressed, setPressed] = useState(false)

  return (
    <div style={{
      background: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: '14px',
      padding: '16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Icon bubble */}
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', flexShrink: 0,
        }}>
          {task.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <p style={{
              fontSize: '14px', fontWeight: 600, margin: 0,
              color: task.status === 'approved' ? '#9ca3af' : '#111827',
              textDecoration: task.status === 'approved' ? 'line-through' : 'none',
            }}>
              {task.title}
            </p>
            <span style={{
              fontSize: '12px', fontWeight: 600, flexShrink: 0,
              padding: '3px 10px', borderRadius: '20px',
              background: config.badgeBg, color: config.badgeColor,
            }}>
              {config.badgeLabel}
            </span>
          </div>

          {task.description && (
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>{task.description}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
            <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>+{task.credit_value} credits</span>
          </div>
          {task.due_time && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Clock size={11} style={{ color: '#9ca3af' }} />
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{formatTimeLabel(task.due_time)}</span>
            </div>
          )}
        </div>
      </div>

      {canSubmit && (
        <button
          onClick={onSubmit}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          style={{
            width: '100%', marginTop: '12px',
            padding: '10px', borderRadius: '10px',
            background: '#6366f1', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transform: pressed ? 'scale(0.98)' : 'scale(1)',
            transition: 'transform 0.1s',
          }}
        >
          <Camera size={15} /> Mark as Done
        </button>
      )}

      {task.task_submissions?.[0]?.photo_url && (
        <img
          src={task.task_submissions[0].photo_url}
          alt="Submitted"
          style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '10px', marginTop: '10px', opacity: 0.85 }}
        />
      )}

      {task.task_submissions?.[0]?.ai_reasoning && task.status !== 'pending' && (
        <div style={{
          marginTop: '10px', padding: '10px 12px', borderRadius: '10px',
          background: task.task_submissions[0].ai_approved ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${task.task_submissions[0].ai_approved ? '#bbf7d0' : '#fde68a'}`,
          display: 'flex', gap: '8px', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>
            {task.task_submissions[0].ai_approved ? '🤖✅' : '🤖🔍'}
          </span>
          <p style={{
            fontSize: '12px', margin: 0, lineHeight: 1.5,
            color: task.task_submissions[0].ai_approved ? '#166534' : '#92400e',
          }}>
            {task.task_submissions[0].ai_reasoning}
          </p>
        </div>
      )}

      {task.status === 'rejected' && !task.task_submissions?.[0]?.ai_reasoning && (
        <div style={{
          marginTop: '10px', padding: '10px 12px', borderRadius: '10px',
          background: '#fef2f2', border: '1px solid #fecaca',
        }}>
          <p style={{ fontSize: '12px', margin: 0, color: '#dc2626' }}>
            💪 Not approved this time — give it another try!
          </p>
        </div>
      )}
    </div>
  )
}
