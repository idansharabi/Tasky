import { useEffect, useRef, useState, useCallback } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { Star, Flame, Trophy, LayoutList, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import TaskCard from './TaskCard'
import SubmitModal from './SubmitModal'

// ── Timeline constants ────────────────────────────────────────
const HOUR_START  = 6
const HOUR_END    = 22
const SLOT_HEIGHT = 80   // px per hour row (slightly compact for single-col)
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

const TASK_STATUS_STYLE = {
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

const STATUS_COLORS = {
  approved:  '#16a34a',
  submitted: '#3b82f6',
  rejected:  '#ef4444',
  pending:   '#d1d5db',
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
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd')

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
    const channel = supabase
      .channel(`kid-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments', filter: `kid_id=eq.${profile.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_ledger', filter: `kid_id=eq.${profile.id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load, profile.id])

  const todayTasks = allTasks.filter((t) => t.due_date === today)
  const selectedTasks = allTasks.filter((t) => t.due_date === selectedDate)
  const completedToday = todayTasks.filter((t) => t.status === 'approved').length
  const pctToday = todayTasks.length ? Math.round((completedToday / todayTasks.length) * 100) : 0
  const level = getLevel(balance)
  const levelPct = getLevelProgress(balance)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div style={{ width: '28px', height: '28px', border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>

      {/* ── My Tasks ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>My Tasks</h2>
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {[{ id: 'daily', icon: LayoutList, label: 'Day' }, { id: 'weekly', icon: LayoutGrid, label: 'Week' }].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => { setView(id); if (id === 'daily') setSelectedDate(today) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 12px', borderRadius: '8px', border: 'none',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: view === id ? '#fff' : 'transparent',
                  color: view === id ? '#111827' : '#9ca3af',
                  boxShadow: view === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {view === 'daily' ? (
          <DailyView tasks={selectedTasks} selectedDate={selectedDate} today={today} color={color} onSubmit={setSubmitting} />
        ) : (
          <WeeklyView
            weekDays={weekDays} allTasks={allTasks} today={today} color={color}
            selectedDate={selectedDate} onSelectDay={(d) => setSelectedDate(d)}
            onPrevWeek={() => setWeekAnchor((w) => subWeeks(w, 1))}
            onNextWeek={() => setWeekAnchor((w) => addWeeks(w, 1))}
            weekStart={weekStart} onSubmit={setSubmitting}
          />
        )}
      </div>

      {/* ── Summary ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Summary</h2>

        {/* Stats row */}
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

        {/* Today's progress */}
        {todayTasks.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: 0 }}>Today's Progress</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color, margin: 0 }}>{pctToday}%</p>
            </div>
            <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: color, borderRadius: '4px', width: `${pctToday}%`, transition: 'width 0.7s ease' }} />
            </div>
            {pctToday === 100 && <p style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600, textAlign: 'center', marginTop: '8px' }}>🎉 All done! Amazing work!</p>}
          </div>
        )}

        {/* Level card */}
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

      {submitting && (
        <SubmitModal task={submitting} onClose={() => setSubmitting(null)} onDone={load} />
      )}
    </div>
  )
}

// ── Daily Timeline view ───────────────────────────────────────
function DailyView({ tasks, selectedDate, today, color, onSubmit }) {
  const isToday = selectedDate === today
  const scrollRef = useRef(null)
  const hourSlots = buildHourSlots()

  const anytimeTasks = tasks.filter(t => slotForTask(t) === 'anytime')
  const timedTasks   = tasks.filter(t => slotForTask(t) !== 'anytime')

  // Scroll to current hour (or first task) on mount
  useEffect(() => {
    if (!scrollRef.current) return
    const nowH = new Date().getHours()
    const targetH = isToday ? Math.max(nowH - 1, HOUR_START) : HOUR_START
    const idx = Math.max(0, targetH - HOUR_START)
    scrollRef.current.scrollTop = idx * SLOT_HEIGHT
  }, [selectedDate])

  const dateLabel = (isToday ? 'Today — ' : '') + format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d')

  if (tasks.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{dateLabel}</p>
        <div style={{ background: '#fff', borderRadius: '16px', border: '2px dashed #e5e7eb', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎉</div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>{isToday ? 'No tasks today!' : 'No tasks this day'}</p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Enjoy your free time</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{dateLabel}</p>
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

      {/* Anytime row */}
      {anytimeTasks.length > 0 && (
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{
            width: TIME_COL_W + 'px', flexShrink: 0, padding: '8px 6px',
            fontSize: '10px', fontWeight: 700, color: '#9ca3af', textAlign: 'right',
            borderRight: '1px solid #f3f4f6', background: '#fafafa',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          }}>
            anytime
          </div>
          <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {anytimeTasks.map(t => (
              <TimelineTaskPill key={t.id} task={t} color={color} onSubmit={onSubmit} />
            ))}
          </div>
        </div>
      )}

      {/* Scrollable hourly grid */}
      <div ref={scrollRef} style={{ overflowY: 'auto', maxHeight: '480px' }}>
        {hourSlots.map(slot => {
          const slotTasks = timedTasks.filter(t => slotForTask(t) === slot)
          const nowH = new Date().getHours()
          const slotH = parseInt(slot, 10)
          const isCurrent = isToday && nowH === slotH
          return (
            <div key={slot} style={{
              display: 'flex', height: SLOT_HEIGHT + 'px',
              background: isCurrent ? '#fffbeb' : 'transparent',
              borderLeft: isCurrent ? `3px solid #f59e0b` : '3px solid transparent',
              borderBottom: '1px solid #f3f4f6',
            }}>
              {/* Time label */}
              <div style={{
                width: TIME_COL_W + 'px', flexShrink: 0,
                paddingRight: '8px', paddingTop: '8px',
                fontSize: '11px', fontWeight: 600,
                color: isCurrent ? '#d97706' : '#9ca3af',
                textAlign: 'right', borderRight: '1px solid #f3f4f6',
                background: isCurrent ? '#fffbeb' : '#fafafa',
                boxSizing: 'border-box',
              }}>
                {fmtHour(slot)}
              </div>
              {/* Task pills */}
              <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                {slotTasks.map(t => (
                  <TimelineTaskPill key={t.id} task={t} color={color} onSubmit={onSubmit} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}

function TimelineTaskPill({ task, color, onSubmit }) {
  const st = TASK_STATUS_STYLE[task.status] || TASK_STATUS_STYLE.pending
  const canSubmit = task.status === 'pending' || task.status === 'rejected'
  return (
    <div
      onClick={() => canSubmit && onSubmit(task)}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '5px 9px', borderRadius: '8px',
        background: canSubmit ? color + '15' : st.bg,
        borderLeft: `3px solid ${canSubmit ? color : st.border}`,
        cursor: canSubmit ? 'pointer' : 'default',
        transition: 'opacity 0.12s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (canSubmit) e.currentTarget.style.opacity = '0.8' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{task.icon}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px', background: st.bg, color: st.color, flexShrink: 0, border: `1px solid ${st.border}` }}>
        {st.label}
      </span>
      {canSubmit && (
        <span style={{ fontSize: '10px', color: color, fontWeight: 700, flexShrink: 0 }}>Tap →</span>
      )}
    </div>
  )
}

// ── Weekly view ───────────────────────────────────────────────
function WeeklyView({ weekDays, allTasks, today, color, selectedDate, onSelectDay, onPrevWeek, onNextWeek, weekStart, onSubmit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onPrevWeek} style={{ padding: '6px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', color: '#6b7280' }}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
        </span>
        <button onClick={onNextWeek} style={{ padding: '6px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', color: '#6b7280' }}>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day selector strip */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {weekDays.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const isToday = dayStr === today
          const isSelected = dayStr === selectedDate
          const dayTasks = allTasks.filter((t) => t.due_date === dayStr)
          const done = dayTasks.filter((t) => t.status === 'approved').length
          const total = dayTasks.length

          return (
            <button
              key={dayStr}
              onClick={() => onSelectDay(dayStr)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '10px 10px 8px', borderRadius: '14px', minWidth: '44px',
                flexShrink: 0, cursor: 'pointer', border: 'none',
                background: isSelected ? color : isToday ? color + '18' : '#fff',
                boxShadow: isSelected ? `0 2px 8px ${color}40` : '0 1px 3px rgba(0,0,0,0.06)',
                outline: isSelected ? 'none' : isToday ? `2px solid ${color}40` : 'none',
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: isSelected ? 'rgba(255,255,255,0.8)' : '#9ca3af' }}>
                {format(day, 'EEE')}
              </span>
              <span style={{ fontSize: '17px', fontWeight: 700, marginTop: '2px', color: isSelected ? '#fff' : isToday ? color : '#111827' }}>
                {format(day, 'd')}
              </span>
              {/* Task dots */}
              <div style={{ display: 'flex', gap: '3px', marginTop: '5px', height: '6px', alignItems: 'center' }}>
                {total === 0 ? (
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.3)' : '#e5e7eb' }} />
                ) : (
                  Array.from({ length: Math.min(total, 4) }).map((_, i) => (
                    <div key={i} style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      background: i < done
                        ? (isSelected ? '#fff' : '#22c55e')
                        : (isSelected ? 'rgba(255,255,255,0.35)' : '#e5e7eb'),
                    }} />
                  ))
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day tasks */}
      <DailyView
        tasks={allTasks.filter((t) => t.due_date === selectedDate)}
        selectedDate={selectedDate}
        today={today}
        color={color}
        onSubmit={onSubmit}
      />
    </div>
  )
}
