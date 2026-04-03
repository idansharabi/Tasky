import { useEffect, useState, useCallback } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { Trash2, ChevronLeft, ChevronRight, Star, LayoutList, LayoutGrid } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmDialog from '../shared/ConfirmDialog'
import { logAction } from '../../lib/audit'

const STATUS_STYLE = {
  approved:  { bg: '#dcfce7', color: '#16a34a', label: 'Done' },
  submitted: { bg: '#dbeafe', color: '#2563eb', label: 'Review' },
  rejected:  { bg: '#fee2e2', color: '#dc2626', label: 'Redo' },
  pending:   { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
}

// ── Shared: Draggable template card ──────────────────────────
function DraggableTemplate({ tpl }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tpl.id, data: { tpl } })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '11px 12px',
        background: isDragging ? '#eef2ff' : '#fff',
        borderRadius: '12px',
        border: isDragging ? '1.5px solid #6366f1' : '1px solid #f3f4f6',
        boxShadow: isDragging ? '0 4px 16px rgba(99,102,241,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'grab', opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{tpl.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
          <Star size={9} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{tpl.credit_value} cr</span>
        </div>
      </div>
      <GripDots />
    </div>
  )
}

function GripDots() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', opacity: 0.25 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ display: 'flex', gap: '3px' }}>
          <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#6b7280' }} />
          <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#6b7280' }} />
        </div>
      ))}
    </div>
  )
}

function OverlayCard({ tpl }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '11px 12px', background: '#fff', borderRadius: '12px',
      border: '1.5px solid #6366f1', boxShadow: '0 8px 24px rgba(99,102,241,0.25)',
      cursor: 'grabbing', width: '220px',
    }}>
      <span style={{ fontSize: '18px' }}>{tpl.icon}</span>
      <div>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>{tpl.title}</p>
        <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>+{tpl.credit_value} credits</p>
      </div>
    </div>
  )
}

// ── Task Bank panel — desktop (vertical list) ────────────────
function TaskBankPanel({ templates }) {
  return (
    <div style={{ width: '260px', flexShrink: 0, paddingLeft: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 12px' }}>
        Task Bank
      </h2>
      {templates.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '2px dashed #e5e7eb' }}>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>No tasks yet.</p>
          <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px' }}>Add some in Task Bank.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {templates.map((tpl) => <DraggableTemplate key={tpl.id} tpl={tpl} />)}
        </div>
      )}
    </div>
  )
}

// ── Task Bank panel — mobile (horizontal strip) ───────────────
function TaskBankMobile({ templates }) {
  return (
    <div style={{ flexShrink: 0, borderTop: '1px solid #f3f4f6', padding: '12px 16px 8px' }}>
      <h2 style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 10px' }}>
        Task Bank — drag to assign
      </h2>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
        {templates.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>No tasks yet.</p>
        ) : (
          templates.map((tpl) => <DraggableTemplateMobile key={tpl.id} tpl={tpl} />)
        )}
      </div>
    </div>
  )
}

function DraggableTemplateMobile({ tpl }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tpl.id, data: { tpl } })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        padding: '10px 12px', flexShrink: 0,
        background: isDragging ? '#eef2ff' : '#fff',
        borderRadius: '12px',
        border: isDragging ? '1.5px solid #6366f1' : '1px solid #e5e7eb',
        boxShadow: isDragging ? '0 4px 16px rgba(99,102,241,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: 'grab', opacity: isDragging ? 0.4 : 1,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        userSelect: 'none', touchAction: 'none',
        minWidth: '72px', maxWidth: '88px',
      }}
    >
      <span style={{ fontSize: '22px' }}>{tpl.icon}</span>
      <span style={{ fontSize: '10px', fontWeight: 600, color: '#111827', textAlign: 'center', lineHeight: 1.2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
        {tpl.title}
      </span>
      <span style={{ fontSize: '10px', color: '#9ca3af' }}>+{tpl.credit_value}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// DAILY VIEW
// ══════════════════════════════════════════════════════════════
function DailyKidZone({ kid, tasks, onDelete, isOver }) {
  const { setNodeRef } = useDroppable({ id: kid.id })
  return (
    <div ref={setNodeRef} style={{
      background: isOver ? kid.avatar_color + '12' : '#fff',
      borderRadius: '14px',
      border: isOver ? `2px solid ${kid.avatar_color}` : '1px solid #f3f4f6',
      boxShadow: isOver ? `0 0 0 4px ${kid.avatar_color}18` : '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'all 0.15s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '11px 16px',
        background: kid.avatar_color + '15',
        borderBottom: `1px solid ${kid.avatar_color}25`,
      }}>
        <span style={{ fontSize: '18px' }}>{kid.avatar_emoji}</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{kid.name}</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        {isOver && <span style={{ fontSize: '12px', color: kid.avatar_color, fontWeight: 600 }}>Drop!</span>}
      </div>
      <div style={{ minHeight: '48px' }}>
        {tasks.length === 0 ? (
          <div style={{ padding: '14px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#d1d5db', margin: 0 }}>{isOver ? '✨ Release to assign' : 'Drag tasks here'}</p>
          </div>
        ) : (
          tasks.map((task, i) => (
            <DailyTaskRow key={task.id} task={task} isLast={i === tasks.length - 1} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  )
}

function DailyTaskRow({ task, isLast, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const st = STATUS_STYLE[task.status] || STATUS_STYLE.pending
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px',
        borderBottom: isLast ? 'none' : '1px solid #f9fafb',
        background: hovered ? '#fafafa' : 'transparent',
      }}
    >
      <span style={{ fontSize: '16px' }}>{task.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>+{task.credit_value}</span>
      <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: st.bg, color: st.color }}>{st.label}</span>
      <button onClick={() => onDelete(task)} style={{
        padding: '5px', borderRadius: '7px', border: 'none',
        background: hovered ? '#fef2f2' : 'transparent',
        color: hovered ? '#ef4444' : '#e5e7eb',
        cursor: 'pointer', display: 'flex',
        opacity: hovered ? 1 : 0.4, transition: 'all 0.1s',
      }}>
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// WEEKLY VIEW
// ══════════════════════════════════════════════════════════════
function WeeklyCell({ kidId, dateStr, tasks, onDelete, isOver, kidColor }) {
  const { setNodeRef } = useDroppable({ id: `${kidId}__${dateStr}` })
  return (
    <div ref={setNodeRef} style={{
      minHeight: '72px',
      padding: '6px',
      background: isOver ? kidColor + '12' : 'transparent',
      border: isOver ? `1.5px solid ${kidColor}` : '1.5px solid transparent',
      borderRadius: '10px',
      transition: 'all 0.12s',
    }}>
      {tasks.length === 0 ? (
        <div style={{ height: '100%', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', color: isOver ? kidColor : '#e5e7eb' }}>{isOver ? '+ Drop' : '—'}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tasks.slice(0, 3).map((task) => (
            <WeeklyTaskPill key={task.id} task={task} onDelete={onDelete} />
          ))}
          {tasks.length > 3 && (
            <span style={{ fontSize: '10px', color: '#9ca3af', paddingLeft: '2px' }}>+{tasks.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  )
}

function WeeklyTaskPill({ task, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const st = STATUS_STYLE[task.status] || STATUS_STYLE.pending
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '3px 6px', borderRadius: '6px',
        background: st.bg, cursor: 'default',
        position: 'relative',
      }}
    >
      <span style={{ fontSize: '11px' }}>{task.icon}</span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: st.color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
      {hovered && (
        <button
          onClick={() => onDelete(task)}
          style={{ padding: '1px', border: 'none', background: 'none', cursor: 'pointer', color: st.color, display: 'flex', flexShrink: 0 }}
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
export default function TaskScheduler() {
  const { profile } = useAuth()
  const [view, setView] = useState('daily') // 'daily' | 'weekly'
  const [kids, setKids] = useState([])
  const [templates, setTemplates] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [overId, setOverId] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const weekStart = startOfWeek(new Date(selectedDate + 'T00:00:00'), { weekStartsOn: 0 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    const [kidsRes, templatesRes, assignRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'kid').order('name'),
      supabase.from('task_templates').select('*').order('title'),
      supabase
        .from('task_assignments')
        .select('*')
        .gte('due_date', weekStartStr)
        .lte('due_date', weekEndStr)
        .order('created_at'),
    ])
    setKids(kidsRes.data || [])
    setTemplates(templatesRes.data || [])
    setAssignments(assignRes.data || [])
  }, [profile.id, weekStartStr, weekEndStr])

  useEffect(() => { load() }, [load])

  async function handleDrop(kidId, dateStr, tpl) {
    const { error } = await supabase.from('task_assignments').insert({
      template_id: tpl.id,
      kid_id: kidId,
      title: tpl.title,
      description: tpl.description || null,
      credit_value: tpl.credit_value,
      icon: tpl.icon,
      due_date: dateStr,
      is_recurring: false,
      recurrence_type: null,
      created_by: profile.id,
    })
    if (!error) {
      toast.success(`${tpl.icon} assigned!`)
      const kid = kids.find(k => k.id === kidId)
      logAction(profile, 'Task assigned', 'task', `"${tpl.title}" → ${kid?.name || kidId} on ${dateStr}`)
      load()
    } else toast.error(error.message)
  }

  function onDragEnd({ active, over }) {
    setActiveTemplate(null)
    setOverId(null)
    if (!over || !active.data.current?.tpl) return
    const tpl = active.data.current.tpl
    const overId = over.id

    if (view === 'daily') {
      // over.id = kidId
      handleDrop(overId, selectedDate, tpl)
    } else {
      // over.id = `${kidId}__${dateStr}`
      const [kidId, dateStr] = overId.split('__')
      handleDrop(kidId, dateStr, tpl)
    }
  }

  async function handleDelete() {
    const { error } = await supabase.from('task_assignments').delete().eq('id', deleteTarget.id)
    if (!error) {
      toast.success('Task removed')
      logAction(profile, 'Task removed', 'task', `"${deleteTarget.title}" on ${deleteTarget.due_date}`)
      load()
    }
    setDeleteTarget(null)
  }

  async function generateRecurring() {
    const { data: rec } = await supabase.from('task_assignments').select('*').eq('is_recurring', true).lte('due_date', format(addDays(new Date(), -1), 'yyyy-MM-dd'))
    if (!rec?.length) { toast('No recurring tasks to generate'); return }
    const dayOfWeek = new Date().getDay()
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const toInsert = rec.filter((t) => {
      if (t.recurrence_type === 'daily') return true
      if (t.recurrence_type === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5
      if (t.recurrence_type === 'weekly') return new Date(t.due_date).getDay() === dayOfWeek
      return false
    }).map((t) => ({ template_id: t.template_id, kid_id: t.kid_id, title: t.title, description: t.description, credit_value: t.credit_value, icon: t.icon, due_date: todayStr, is_recurring: true, recurrence_type: t.recurrence_type, created_by: t.created_by }))
    if (!toInsert.length) { toast('Already generated for today'); return }
    const { error } = await supabase.from('task_assignments').insert(toInsert)
    if (!error) { toast.success(`Generated ${toInsert.length} tasks`); load() }
    else toast.error(error.message)
  }

  // Determine what's "over" for highlighting
  function getOverKidId() {
    if (!overId) return null
    if (view === 'daily') return overId
    return null
  }
  function getOverCellId() {
    if (!overId || view === 'daily') return null
    return overId // `${kidId}__${dateStr}`
  }

  const dailyAssignments = assignments.filter((a) => a.due_date === selectedDate)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: isMobile ? '16px 16px 0' : '28px 40px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.4px' }}>Schedule</h1>
            {!isMobile && <p style={{ fontSize: '14px', color: '#9ca3af', margin: '4px 0 0' }}>Drag tasks onto kids to assign them</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', gap: '2px' }}>
              {[
                { id: 'daily',  icon: LayoutList, label: 'Daily' },
                { id: 'weekly', icon: LayoutGrid,  label: 'Weekly' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: isMobile ? '0' : '6px',
                    padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: '8px', border: 'none',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    background: view === id ? '#fff' : 'transparent',
                    color: view === id ? '#111827' : '#9ca3af',
                    boxShadow: view === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={14} />{!isMobile && ` ${label}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px', marginBottom: '16px' }}>
          <button
            onClick={() => setSelectedDate(format(view === 'weekly' ? subWeeks(new Date(selectedDate + 'T00:00:00'), 1) : addDays(new Date(selectedDate + 'T00:00:00'), -7), 'yyyy-MM-dd'))}
            style={{ padding: '7px', borderRadius: '9px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280', flexShrink: 0, display: 'flex' }}
          >
            <ChevronLeft size={16} />
          </button>

          {view === 'daily' ? (
            // Daily: show individual day buttons
            weekDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const isSelected = dayStr === selectedDate
              const isToday = dayStr === today
              return (
                <button key={dayStr} onClick={() => setSelectedDate(dayStr)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: isMobile ? '6px 8px' : '8px 12px', borderRadius: '10px',
                  minWidth: isMobile ? '36px' : '48px', flexShrink: 0, flex: isMobile ? 1 : undefined,
                  border: isSelected ? 'none' : '1px solid #e5e7eb',
                  background: isSelected ? '#6366f1' : isToday ? '#eef2ff' : '#fff',
                  color: isSelected ? '#fff' : isToday ? '#6366f1' : '#374151',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: isMobile ? '9px' : '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{format(day, 'EEE')}</span>
                  <span style={{ fontSize: isMobile ? '14px' : '17px', fontWeight: 700, marginTop: '1px' }}>{format(day, 'd')}</span>
                </button>
              )
            })
          ) : (
            // Weekly: show week range label
            <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </div>
          )}

          <button
            onClick={() => setSelectedDate(format(view === 'weekly' ? addWeeks(new Date(selectedDate + 'T00:00:00'), 1) : addDays(new Date(selectedDate + 'T00:00:00'), 7), 'yyyy-MM-dd'))}
            style={{ padding: '7px', borderRadius: '9px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280', flexShrink: 0, display: 'flex' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveTemplate(active.data.current?.tpl || null)}
        onDragOver={({ over }) => setOverId(over?.id || null)}
        onDragEnd={onDragEnd}
        onDragCancel={() => { setActiveTemplate(null); setOverId(null) }}
      >
        <div style={{
          flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0,
          flexDirection: isMobile ? 'column' : 'row',
          padding: isMobile ? '0 0 0' : '0 40px 32px',
          gap: '0',
        }}>

          {view === 'daily' ? (
            // ── Daily view ──────────────────────────────────────────
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: isMobile ? '0' : '20px', padding: isMobile ? '0 16px 8px' : undefined, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                  {format(new Date(selectedDate + 'T00:00:00'), isMobile ? 'EEE, MMM d' : 'EEEE, MMMM d')}
                </span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{dailyAssignments.length} task{dailyAssignments.length !== 1 ? 's' : ''}</span>
              </div>
              {kids.map((kid) => (
                <DailyKidZone
                  key={kid.id}
                  kid={kid}
                  tasks={dailyAssignments.filter((a) => a.kid_id === kid.id)}
                  onDelete={setDeleteTarget}
                  isOver={getOverKidId() === kid.id}
                />
              ))}
            </div>
          ) : (
            // ── Weekly view ─────────────────────────────────────────
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '700px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '100px', padding: '0 12px 12px 0', textAlign: 'left' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Kid</span>
                    </th>
                    {weekDays.map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd')
                      const isToday = dayStr === today
                      return (
                        <th key={dayStr} style={{ padding: '0 4px 12px', textAlign: 'center', minWidth: '110px' }}>
                          <div style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            padding: '6px 14px', borderRadius: '10px',
                            background: isToday ? '#eef2ff' : 'transparent',
                          }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: isToday ? '#6366f1' : '#9ca3af' }}>{format(day, 'EEE')}</span>
                            <span style={{ fontSize: '18px', fontWeight: 700, color: isToday ? '#6366f1' : '#374151' }}>{format(day, 'd')}</span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {kids.map((kid, kidIdx) => (
                    <tr key={kid.id} style={{ borderTop: kidIdx === 0 ? '1px solid #f3f4f6' : '1px solid #f3f4f6' }}>
                      {/* Kid label */}
                      <td style={{ padding: '8px 12px 8px 0', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            background: kid.avatar_color + '20',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                          }}>
                            {kid.avatar_emoji}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{kid.name}</span>
                        </div>
                      </td>
                      {/* Day cells */}
                      {weekDays.map((day) => {
                        const dayStr = format(day, 'yyyy-MM-dd')
                        const cellId = `${kid.id}__${dayStr}`
                        const cellTasks = assignments.filter((a) => a.kid_id === kid.id && a.due_date === dayStr)
                        return (
                          <td key={dayStr} style={{ padding: '4px', verticalAlign: 'top' }}>
                            <WeeklyCell
                              kidId={kid.id}
                              dateStr={dayStr}
                              tasks={cellTasks}
                              onDelete={setDeleteTarget}
                              isOver={getOverCellId() === cellId}
                              kidColor={kid.avatar_color}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Divider + Task Bank — desktop only */}
          {!isMobile && (
            <>
              <div style={{ width: '1px', background: '#f3f4f6', flexShrink: 0, marginLeft: view === 'daily' ? '0' : '20px' }} />
              <TaskBankPanel templates={templates} />
            </>
          )}
        </div>

        {/* Task Bank — mobile horizontal strip at bottom */}
        {isMobile && <TaskBankMobile templates={templates} />}

        <DragOverlay dropAnimation={null}>
          {activeTemplate ? <OverlayCard tpl={activeTemplate} /> : null}
        </DragOverlay>
      </DndContext>

      {deleteTarget && (
        <ConfirmDialog
          message={`Remove "${deleteTarget.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Remove"
        />
      )}
    </div>
  )
}
