import { useEffect, useRef, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Star, AlertCircle, Plus, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../shared/Modal'
import TaskComments from '../shared/TaskComments'
import { sendPush } from '../../lib/notifications'
import { logAction } from '../../lib/audit'

const STATUS = {
  pending:   { label: 'Pending',   bg: '#f3f4f6', color: '#6b7280' },
  submitted: { label: 'Submitted', bg: '#eff6ff', color: '#3b82f6' },
  approved:  { label: 'Done',      bg: '#f0fdf4', color: '#16a34a' },
  rejected:  { label: 'Rejected',  bg: '#fef2f2', color: '#ef4444' },
}

export default function ParentDashboard({ onNavigate }) {
  const { profile } = useAuth()
  const [kids, setKids] = useState([])
  const [pendingSubmissions, setPendingSubmissions] = useState([])
  const [todayAssignments, setTodayAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewItem, setReviewItem] = useState(null)
  const [manualCreditKid, setManualCreditKid] = useState(null)
  const kidsRef = useRef(null)
  const [manualAmount, setManualAmount] = useState('')
  const [manualNote, setManualNote] = useState('')

  const today = format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    const [kidsRes, pendingRes, todayRes] = await Promise.all([
      supabase.from('kid_balances').select('*'),
      supabase
        .from('task_assignments')
        .select('*, task_submissions(*), profiles!task_assignments_kid_id_fkey(name, avatar_emoji, avatar_color)')
        .eq('status', 'submitted')
        .order('created_at', { ascending: false }),
      supabase
        .from('task_assignments')
        .select('*, profiles!task_assignments_kid_id_fkey(name, avatar_emoji, avatar_color)')
        .eq('due_date', today)
        .order('kid_id'),
    ])
    setKids(kidsRes.data || [])
    setPendingSubmissions(pendingRes.data || [])
    setTodayAssignments(todayRes.data || [])
    setLoading(false)
  }, [today])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('parent-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_submissions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_ledger' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  async function handleApprove(assignment) {
    const submission = assignment.task_submissions?.[0]
    await supabase.from('task_assignments').update({ status: 'approved' }).eq('id', assignment.id)
    if (submission) await supabase.from('task_submissions').update({ parent_override: true }).eq('id', submission.id)
    await supabase.from('credit_ledger').insert({
      kid_id: assignment.kid_id,
      amount: assignment.credit_value,
      description: `Task approved: ${assignment.title}`,
      assignment_id: assignment.id,
      created_by: profile.id,
    })
    toast.success(`Approved · +${assignment.credit_value} credits`)
    sendPush([assignment.kid_id], 'Task Approved! 🎉', `+${assignment.credit_value} credits for "${assignment.title}"`)
    logAction(profile, 'Task approved', 'task', `"${assignment.title}" for ${assignment.profiles?.name || assignment.kid_id} · +${assignment.credit_value} credits`)
    setReviewItem(null); load()
  }

  async function handleReject(assignment) {
    await supabase.from('task_assignments').update({ status: 'rejected' }).eq('id', assignment.id)
    toast.success('Task rejected')
    sendPush([assignment.kid_id], 'Try Again 💪', `"${assignment.title}" needs another attempt.`)
    logAction(profile, 'Task rejected', 'task', `"${assignment.title}" for ${assignment.profiles?.name || assignment.kid_id}`)
    setReviewItem(null); load()
  }

  async function handleManualCredit(e) {
    e.preventDefault()
    const amount = parseInt(manualAmount)
    if (isNaN(amount) || amount === 0) return toast.error('Enter a valid amount')
    await supabase.from('credit_ledger').insert({
      kid_id: manualCreditKid.id,
      amount,
      description: manualNote || (amount > 0 ? 'Bonus credit' : 'Deduction'),
      created_by: profile.id,
    })
    toast.success(`${amount > 0 ? '+' : ''}${amount} credits for ${manualCreditKid.name}`)
    logAction(profile, amount > 0 ? 'Credits added' : 'Credits deducted', 'credit', `${amount > 0 ? '+' : ''}${amount} for ${manualCreditKid.name}${manualNote ? ` · "${manualNote}"` : ''}`)
    setManualCreditKid(null); setManualAmount(''); setManualNote(''); load()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
      <div style={{ width: '28px', height: '28px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const doneTasks = todayAssignments.filter(t => t.status === 'approved').length
  const totalTasks = todayAssignments.length

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 56px 80px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>
          Good {getGreeting()}, {profile?.name || 'there'} 👋
        </h1>
        <p style={{ fontSize: '15px', color: '#9ca3af', marginTop: '6px' }}>
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Pending alert */}
      {pendingSubmissions.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '12px', padding: '14px 18px', marginBottom: '40px',
        }}>
          <AlertCircle size={16} color="#d97706" />
          <span style={{ fontSize: '14px', color: '#92400e', fontWeight: 500, flex: 1 }}>
            {pendingSubmissions.length} task{pendingSubmissions.length > 1 ? 's' : ''} waiting for your review
          </span>
          <button
            onClick={() => kidsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{
              fontSize: '13px', fontWeight: 600, color: '#d97706',
              background: 'none', border: '1px solid #fde68a', borderRadius: '8px',
              padding: '5px 12px', cursor: 'pointer', flexShrink: 0,
            }}
          >
            Review now ↓
          </button>
        </div>
      )}

      {/* Kids section */}
      <Section title="Kids" count={kids.length} sectionRef={kidsRef}>
        {kids.length === 0 ? (
          <EmptyBox text="No kids yet. They'll appear once they sign up with the Kid role." />
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {kids.map(kid => {
                    const kidTasks = todayAssignments.filter(t => t.kid_id === kid.id)
                    const done = kidTasks.filter(t => t.status === 'approved').length
                    const pct = kidTasks.length ? Math.round((done / kidTasks.length) * 100) : 0
                    const pending = pendingSubmissions.filter(t => t.kid_id === kid.id)
                    return (
                      <th key={kid.id} style={{
                        padding: '16px 20px', textAlign: 'left',
                        background: kid.avatar_color + '08',
                        borderRight: '1px solid #f3f4f6',
                        borderTop: `3px solid ${kid.avatar_color}`,
                      }}>
                        {/* Kid identity */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '22px' }}>{kid.avatar_emoji}</span>
                            <div>
                              <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>{kid.name}</p>
                              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{done}/{kidTasks.length} done today</p>
                            </div>
                          </div>
                          <button onClick={() => setManualCreditKid(kid)} title="Adjust credits"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px', flexShrink: 0 }}>
                            <TrendingUp size={13} />
                          </button>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '99px', marginBottom: '8px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: kid.avatar_color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
                        </div>
                        {/* Balance + pending badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Star size={11} fill="#fbbf24" color="#fbbf24" />
                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>{kid.balance}</span>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>credits</span>
                          </div>
                          {pending.length > 0 && (
                            <span style={{
                              fontSize: '10px', fontWeight: 700, color: '#fff',
                              background: '#f59e0b', borderRadius: '99px', padding: '2px 7px',
                            }}>
                              {pending.length} pending
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Build rows: each row index corresponds to the Nth pending task
                  const maxRows = Math.max(...kids.map(kid =>
                    pendingSubmissions.filter(t => t.kid_id === kid.id).length
                  ), 0)

                  if (maxRows === 0) {
                    return (
                      <tr>
                        <td colSpan={kids.length} style={{ padding: '32px', textAlign: 'center' }}>
                          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>No pending tasks to review 🎉</p>
                        </td>
                      </tr>
                    )
                  }

                  return Array.from({ length: maxRows }, (_, rowIdx) => (
                    <tr key={rowIdx} style={{ borderTop: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                      {kids.map(kid => {
                        const kidPending = pendingSubmissions.filter(t => t.kid_id === kid.id)
                        const task = kidPending[rowIdx]
                        const sub = task?.task_submissions?.[0]
                        return (
                          <td key={kid.id} style={{
                            padding: task ? '14px 20px' : '14px 20px',
                            borderRight: '1px solid #f9fafb',
                            background: task ? '#fff' : '#fafafa',
                            verticalAlign: 'top',
                          }}>
                            {task ? (
                              <div>
                                {/* Task title */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{task.icon}</span>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{task.title}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                      <Star size={10} fill="#f59e0b" color="#f59e0b" />
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>+{task.credit_value}</span>
                                    </div>
                                    {sub?.ai_reasoning && (
                                      <p style={{ fontSize: '11px', color: sub.ai_approved ? '#16a34a' : '#d97706', margin: '4px 0 0', lineHeight: 1.3 }}>
                                        AI {sub.ai_approved ? '✓' : '?'} {sub.ai_reasoning}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {/* Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {sub?.photo_url && (
                                    <button onClick={() => setReviewItem(task)}
                                      style={{ fontSize: '11px', padding: '4px 9px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
                                      Photo
                                    </button>
                                  )}
                                  <button onClick={() => handleReject(task)}
                                    style={{ width: '26px', height: '26px', border: '1px solid #fee2e2', borderRadius: '6px', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <XCircle size={13} color="#ef4444" />
                                  </button>
                                  <button onClick={() => handleApprove(task)}
                                    style={{ width: '26px', height: '26px', border: '1px solid #bbf7d0', borderRadius: '6px', background: '#f0fdf4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle size={13} color="#16a34a" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#e5e7eb', fontSize: '18px' }}>—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Pending review — now embedded in the Kids table above */}

      {/* Today's tasks */}
      <Section
        title="Today's tasks"
        meta={totalTasks > 0 ? `${doneTasks} of ${totalTasks} done` : null}
        action={
          <button onClick={() => onNavigate('schedule')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px' }}>
            <Plus size={14} /> Assign
          </button>
        }
      >
        {todayAssignments.length === 0 ? (
          <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 16px' }}>No tasks scheduled for today.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => onNavigate('bank')}
                style={{ fontSize: '13px', padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
                Task Bank
              </button>
              <button onClick={() => onNavigate('schedule')}
                style={{ fontSize: '13px', padding: '8px 16px', background: '#6366f1', borderRadius: '8px', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Schedule tasks
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {kids.map(kid => {
                    const kidTasks = todayAssignments.filter(t => t.kid_id === kid.id)
                    const done = kidTasks.filter(t => t.status === 'approved').length
                    return (
                      <th key={kid.id} style={{
                        padding: '12px 20px', textAlign: 'left',
                        background: kid.avatar_color + '08',
                        borderRight: '1px solid #f3f4f6',
                        borderTop: `3px solid ${kid.avatar_color}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ fontSize: '18px' }}>{kid.avatar_emoji}</span>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{kid.name}</p>
                            <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{done}/{kidTasks.length} done</p>
                          </div>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxRows = Math.max(...kids.map(kid =>
                    todayAssignments.filter(t => t.kid_id === kid.id).length
                  ), 0)

                  return Array.from({ length: maxRows }, (_, rowIdx) => (
                    <tr key={rowIdx} style={{ borderTop: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                      {kids.map(kid => {
                        const kidTasks = todayAssignments.filter(t => t.kid_id === kid.id)
                        const task = kidTasks[rowIdx]
                        const s = task ? (STATUS[task.status] || STATUS.pending) : null
                        return (
                          <td key={kid.id} style={{
                            padding: '12px 20px',
                            borderRight: '1px solid #f9fafb',
                            background: task ? '#fff' : '#fafafa',
                            verticalAlign: 'top',
                          }}>
                            {task ? (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{task.icon}</span>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{task.title}</p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <Star size={10} fill="#f59e0b" color="#f59e0b" />
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>+{task.credit_value}</span>
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '99px', background: s.bg, color: s.color }}>
                                      {s.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#e5e7eb', fontSize: '18px' }}>—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Review modal */}
      {reviewItem && (
        <Modal title={reviewItem.title} onClose={() => setReviewItem(null)}>
          {reviewItem.task_submissions?.[0]?.photo_url && (
            <img src={reviewItem.task_submissions[0].photo_url} alt="Task" style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '240px', marginBottom: '16px' }} />
          )}
          {reviewItem.task_submissions?.[0]?.ai_reasoning && (
            <p style={{ fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', background: reviewItem.task_submissions[0].ai_approved ? '#f0fdf4' : '#fffbeb', color: reviewItem.task_submissions[0].ai_approved ? '#166534' : '#92400e' }}>
              AI: {reviewItem.task_submissions[0].ai_reasoning}
            </p>
          )}
          <TaskComments assignmentId={reviewItem.id} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={() => handleReject(reviewItem)}
              style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
              Reject
            </button>
            <button onClick={() => handleApprove(reviewItem)}
              style={{ flex: 1, padding: '10px', background: '#6366f1', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              Approve +{reviewItem.credit_value}
            </button>
          </div>
        </Modal>
      )}

      {/* Manual credit modal */}
      {manualCreditKid && (
        <Modal title={`Credits — ${manualCreditKid.name}`} onClose={() => setManualCreditKid(null)} size="sm">
          <form onSubmit={handleManualCredit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Amount (negative to deduct)</label>
              <input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="e.g. 20 or -10" required
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Note (optional)</label>
              <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="e.g. Bonus for helping with dinner"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit"
              style={{ padding: '10px', background: '#6366f1', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              Apply
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Section({ title, children, count, meta, action, sectionRef }) {
  return (
    <div ref={sectionRef} style={{ marginBottom: '52px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
          {count != null && (
            <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '99px', fontWeight: 500 }}>{count}</span>
          )}
          {meta && <span style={{ fontSize: '13px', color: '#9ca3af' }}>{meta}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyBox({ text }) {
  return (
    <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: '14px', padding: '32px', textAlign: 'center' }}>
      <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>{text}</p>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
