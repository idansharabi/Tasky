import { useEffect, useRef, useState, useCallback } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { Star, Flame, Trophy, ChevronLeft, ChevronRight, CheckCircle, LayoutList, LayoutGrid } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import SubmitModal from './SubmitModal'

// ── Timeline constants ────────────────────────────────────────
const HOUR_START  = 6
const HOUR_END    = 22
const SLOT_HEIGHT = 80
const TIME_COL_W  = 52

function buildHourSlots() {
  return Array.from({ length: HOUR_END - HOUR_START }, (_, i) =>
    String(HOUR_START + i).padStart(2, '0') + ':00'
  )
}
function fmtHour(slot) {
  const h = parseInt(slot, 10)
  if (h === 0)  return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}
function slotForTask(task) {
  if (!task.due_time) return 'anytime'
  const h = parseInt(task.due_time, 10)
  if (h < HOUR_START || h >= HOUR_END) return 'anytime'
  return String(h).padStart(2, '0') + ':00'
}

const STATUS_STYLE = {
  pending:   { bg: '#f3f4f6', border: '#d1d5db', color: '#374151', label: 'To Do' },
  submitted: { bg: '#dbeafe', border: '#93c5fd', color: '#1d4ed8', label: 'Waiting…' },
  approved:  { bg: '#dcfce7', border: '#86efac', color: '#15803d', label: 'Done ✓' },
  rejected:  { bg: '#fee2e2', border: '#fca5a5', color: '#b91c1c', label: 'Redo' },
}

const LEVELS = [
  { min: 0,    label: 'Beginner',  emoji: '🌱', color: '#22c55e' },
  { min: 100,  label: 'Helper',    emoji: '🌟', color: '#f59e0b' },
  { min: 300,  label: 'Achiever',  emoji: '🏆', color: '#f97316' },
  { min: 600,  label: 'Champion',  emoji: '👑', color: '#a855f7' },
  { min: 1000, label: 'Legend',    emoji: '🚀', color: '#6366f1' },
]
function getLevel(bal) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (bal >= LEVELS[i].min) return { ...LEVELS[i], index: i }
  }
  return { ...LEVELS[0], index: 0 }
}
function getLevelProgress(bal) {
  const cur = getLevel(bal)
  const next = LEVELS[cur.index + 1]
  if (!next) return 100
  return Math.round(((bal - LEVELS[cur.index].min) / (next.min - LEVELS[cur.index].min)) * 100)
}

export default function KidDashboard() {
  const { profile } = useAuth()
  const [view, setView] = useState('daily')
  const [allTasks, setAllTasks] = useState([])
  const [balance, setBalance] = useState(0)
  const [streak] = useState(0)
  const [submitting, setSubmitting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [weekAnchor, setWeekAnchor] = useState(new Date())

  const today = format(new Date(), 'yyyy-MM-dd')
  const color = profile?.avatar_color || '#6366f1'

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 0 })
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr   = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    const [tasksRes, ledgerRes] = await Promise.all([
      supabase
        .from('task_assignments')
        .select('*, task_submissions(*)')
        .eq('kid_id', profile.id)
        .gte('due_date', weekStartStr)
        .lte('due_date', weekEndStr)
        .order('created_at'),
      supabase.from('credit_ledger').select('amount').eq('kid_id', profile.id),
    ])
    setAllTasks(tasksRes.data || [])
    setBalance((ledgerRes.data || []).reduce((s, r) => s + r.amount, 0))
    setLoading(false)
  }, [profile.id, weekStartStr, weekEndStr])

  useEffect(() => {
    load()
    const ch = supabase
      .channel(`kid-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments', filter: `kid_id=eq.${profile.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_ledger',    filter: `kid_id=eq.${profile.id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load, profile.id])

  const todayTasks     = allTasks.filter(t => t.due_date === today)
  const selectedTasks  = allTasks.filter(t => t.due_date === selectedDate)
  const completedToday = todayTasks.filter(t => t.status === 'approved').length
  const pctToday       = todayTasks.length ? Math.round((completedToday / todayTasks.length) * 100) : 0
  const level          = getLevel(balance)
  const levelPct       = getLevelProgress(balance)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div style={{ width: '28px', height: '28px', border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>

      {/* ── My Tasks ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Toggle row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>My Tasks</h2>
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {[{ id: 'daily', icon: LayoutList, label: 'Day' }, { id: 'weekly', icon: LayoutGrid, label: 'Week' }].map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => { setView(id); if (id === 'daily') setSelectedDate(today) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600,
                  background: view === id ? '#fff' : 'transparent',
                  color: view === id ? '#111827' : '#9ca3af',
                  boxShadow: view === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Weekly-only: week nav + day strip */}
        {view === 'weekly' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setWeekAnchor(w => subWeeks(w, 1))}
                style={{ padding: '6px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', color: '#6b7280' }}>
                <ChevronLeft size={15} />
              </button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
              </span>
              <button onClick={() => setWeekAnchor(w => addWeeks(w, 1))}
                style={{ padding: '6px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', color: '#6b7280' }}>
                <ChevronRight size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
              {weekDays.map(day => {
                const dayStr   = format(day, 'yyyy-MM-dd')
                const isToday_ = dayStr === today
                const isSel    = dayStr === selectedDate
                const dayTasks = allTasks.filter(t => t.due_date === dayStr)
                const done     = dayTasks.filter(t => t.status === 'approved').length
                const total    = dayTasks.length
                return (
                  <button key={dayStr} onClick={() => setSelectedDate(dayStr)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '10px 10px 8px', borderRadius: '14px', minWidth: '44px',
                    flexShrink: 0, cursor: 'pointer', border: 'none',
                    background: isSel ? color : isToday_ ? color + '18' : '#fff',
                    boxShadow: isSel ? `0 2px 8px ${color}40` : '0 1px 3px rgba(0,0,0,0.06)',
                    outline: !isSel && isToday_ ? `2px solid ${color}40` : 'none',
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: isSel ? 'rgba(255,255,255,0.8)' : '#9ca3af' }}>
                      {format(day, 'EEE')}
                    </span>
                    <span style={{ fontSize: '17px', fontWeight: 700, marginTop: '2px', color: isSel ? '#fff' : isToday_ ? color : '#111827' }}>
                      {format(day, 'd')}
                    </span>
                    <div style={{ display: 'flex', gap: '3px', marginTop: '5px', height: '6px', alignItems: 'center' }}>
                      {total === 0 ? (
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.3)' : '#e5e7eb' }} />
                      ) : (
                        Array.from({ length: Math.min(total, 4) }).map((_, i) => (
                          <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%',
                            background: i < done ? (isSel ? '#fff' : '#22c55e') : (isSel ? 'rgba(255,255,255,0.35)' : '#e5e7eb') }} />
                        ))
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Timeline + Today card side by side */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <HourlyTimeline
              tasks={selectedTasks}
              selectedDate={view === 'daily' ? today : selectedDate}
              today={today}
              color={color}
              onSubmit={setSubmitting}
            />
          </div>
          <TodayCard tasks={todayTasks} color={color} pct={pctToday} onSubmit={setSubmitting} />
        </div>
      </div>

      {/* ── Summary ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Summary</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {[
            { top: <><Star size={13} style={{ color: '#f59e0b', fill: '#f59e0b' }} /><span style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{balance}</span></>, label: 'Credits' },
            { top: <span style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{completedToday}/{todayTasks.length}</span>, label: 'Done today' },
            { top: <><Flame size={13} style={{ color: '#f97316' }} /><span style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>{streak}</span></>, label: 'Day streak' },
          ].map((stat, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>{stat.top}</div>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div style={{ borderRadius: '16px', padding: '18px 20px', background: `linear-gradient(135deg, ${level.color}, ${level.color}cc)`, color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 500, opacity: 0.8, margin: '0 0 3px' }}>Your Level</p>
              <p style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>{level.emoji} {level.label}</p>
            </div>
            <Trophy size={28} style={{ opacity: 0.5 }} />
          </div>
          <div style={{ height: '7px', background: 'rgba(255,255,255,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#fff', borderRadius: '4px', width: `${levelPct}%`, transition: 'width 0.7s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
            <span style={{ fontSize: '11px', opacity: 0.7 }}>{balance} credits</span>
            {LEVELS[level.index + 1] && <span style={{ fontSize: '11px', opacity: 0.7 }}>{LEVELS[level.index + 1].min} for {LEVELS[level.index + 1].emoji}</span>}
          </div>
        </div>
      </div>

      {submitting && <SubmitModal task={submitting} onClose={() => setSubmitting(null)} onDone={load} />}
    </div>
  )
}

// ── Today's Tasks card (right panel) ─────────────────────────
function TodayCard({ tasks, color, pct, onSubmit }) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time)
    if (a.due_time) return -1
    if (b.due_time) return 1
    return 0
  })

  return (
    <div style={{
      width: '210px', flexShrink: 0,
      background: '#fff', borderRadius: '16px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      overflow: 'hidden',
      position: 'sticky', top: '16px',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#111827', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Today's Tasks
        </p>
        {/* Progress bar */}
        <div style={{ height: '5px', background: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '5px 0 0' }}>
          {tasks.filter(t => t.status === 'approved').length}/{tasks.length} done
        </p>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: '20px', margin: '0 0 4px' }}>🎉</p>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>No tasks today!</p>
        </div>
      ) : (
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          {sorted.map((task, i) => {
            const st = STATUS_STYLE[task.status] || STATUS_STYLE.pending
            const canSubmit = task.status === 'pending' || task.status === 'rejected'
            const timeLabel = task.due_time ? fmtHour(slotForTask(task)) : '—'
            return (
              <div
                key={task.id}
                onClick={() => canSubmit && onSubmit(task)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px',
                  borderBottom: i < sorted.length - 1 ? '1px solid #f9fafb' : 'none',
                  cursor: canSubmit ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = color + '08' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {/* Time */}
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', width: '34px', flexShrink: 0, textAlign: 'right' }}>
                  {timeLabel}
                </span>
                {/* Icon */}
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{task.icon}</span>
                {/* Title */}
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.title}
                </span>
                {/* Status dot */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: task.status === 'approved' ? '#22c55e' : task.status === 'submitted' ? '#3b82f6' : task.status === 'rejected' ? '#ef4444' : '#d1d5db',
                }} />
              </div>
            )
          })}
        </div>
      )}

      {pct === 100 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #f3f4f6', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle size={13} color="#16a34a" />
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', margin: 0 }}>All done! 🎉</p>
        </div>
      )}
    </div>
  )
}

// ── Hourly timeline ───────────────────────────────────────────
function HourlyTimeline({ tasks, selectedDate, today, color, onSubmit }) {
  const isToday   = selectedDate === today
  const scrollRef = useRef(null)
  const hourSlots = buildHourSlots()
  const anytime   = tasks.filter(t => slotForTask(t) === 'anytime')
  const timed     = tasks.filter(t => slotForTask(t) !== 'anytime')

  useEffect(() => {
    if (!scrollRef.current) return
    const nowH    = new Date().getHours()
    const targetH = isToday ? Math.max(nowH - 1, HOUR_START) : HOUR_START
    scrollRef.current.scrollTop = Math.max(0, targetH - HOUR_START) * SLOT_HEIGHT
  }, [selectedDate])

  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

      {/* Anytime row */}
      {anytime.length > 0 && (
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ width: TIME_COL_W + 'px', flexShrink: 0, padding: '8px 6px', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textAlign: 'right', borderRight: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            anytime
          </div>
          <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {anytime.map(t => <TaskPill key={t.id} task={t} color={color} onSubmit={onSubmit} />)}
          </div>
        </div>
      )}

      {/* Hour rows */}
      <div ref={scrollRef} style={{ overflowY: 'auto', maxHeight: '480px' }}>
        {hourSlots.map(slot => {
          const slotTasks = timed.filter(t => slotForTask(t) === slot)
          const nowH      = new Date().getHours()
          const isCurrent = isToday && nowH === parseInt(slot, 10)
          return (
            <div key={slot} style={{
              display: 'flex', height: SLOT_HEIGHT + 'px',
              background: isCurrent ? '#fffbeb' : 'transparent',
              borderLeft: isCurrent ? '3px solid #f59e0b' : '3px solid transparent',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <div style={{ width: TIME_COL_W + 'px', flexShrink: 0, paddingRight: '8px', paddingTop: '8px', fontSize: '11px', fontWeight: 600, color: isCurrent ? '#d97706' : '#9ca3af', textAlign: 'right', borderRight: '1px solid #f3f4f6', background: isCurrent ? '#fffbeb' : '#fafafa', boxSizing: 'border-box' }}>
                {fmtHour(slot)}
              </div>
              <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                {slotTasks.map(t => <TaskPill key={t.id} task={t} color={color} onSubmit={onSubmit} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskPill({ task, color, onSubmit }) {
  const st         = STATUS_STYLE[task.status] || STATUS_STYLE.pending
  const canSubmit  = task.status === 'pending' || task.status === 'rejected'
  return (
    <div
      onClick={() => canSubmit && onSubmit(task)}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 9px', borderRadius: '8px', background: canSubmit ? color + '15' : st.bg, borderLeft: `3px solid ${canSubmit ? color : st.border}`, cursor: canSubmit ? 'pointer' : 'default', transition: 'opacity 0.12s', userSelect: 'none' }}
      onMouseEnter={e => { if (canSubmit) e.currentTarget.style.opacity = '0.8' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{task.icon}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px', background: st.bg, color: st.color, flexShrink: 0, border: `1px solid ${st.border}` }}>{st.label}</span>
      {canSubmit && <span style={{ fontSize: '10px', color, fontWeight: 700, flexShrink: 0 }}>Tap →</span>}
    </div>
  )
}
