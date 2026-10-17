import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { Trash2, ChevronLeft, ChevronRight, ChevronDown, Star, LayoutList, LayoutGrid, Clock, X, RefreshCw, Pencil } from 'lucide-react'
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
  pointerWithin,
  closestCenter,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmDialog from '../shared/ConfirmDialog'
import { logAction } from '../../lib/audit'

const CATEGORIES = [
  { id: 'Cleaning',  label: 'Cleaning',  emoji: '🧹', color: '#1d4ed8', bg: '#eff6ff' },
  { id: 'Kitchen',   label: 'Kitchen',   emoji: '🍳', color: '#c2410c', bg: '#fff7ed' },
  { id: 'School',    label: 'School',    emoji: '📚', color: '#15803d', bg: '#f0fdf4' },
  { id: 'Hygiene',   label: 'Hygiene',   emoji: '🚿', color: '#7e22ce', bg: '#fdf4ff' },
  { id: 'Pets',      label: 'Pets',      emoji: '🐾', color: '#a16207', bg: '#fefce8' },
  { id: 'Exercise',  label: 'Exercise',  emoji: '💪', color: '#be123c', bg: '#fff1f2' },
  { id: 'Garden',    label: 'Garden',    emoji: '🌱', color: '#166534', bg: '#f0fdf4' },
  { id: 'Other',     label: 'Other',     emoji: '⭐', color: '#374151', bg: '#f9fafb' },
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function describeDays(daysOfWeek) {
  const sorted = [...daysOfWeek].sort((a, b) => a - b)
  if (sorted.length === 7) return 'every day'
  if (sorted.length === 5 && sorted.join(',') === '1,2,3,4,5') return 'weekdays'
  return sorted.map(d => DAY_NAMES[d]).join('/')
}

function datesForWindow(startDateStr, daysOfWeek, windowDays) {
  const base = new Date(startDateStr + 'T00:00:00')
  const set = new Set(daysOfWeek)
  const dates = []
  for (let i = 0; i < windowDays; i++) {
    const d = addDays(base, i)
    if (set.has(d.getDay())) dates.push(format(d, 'yyyy-MM-dd'))
  }
  return dates
}

function recurrenceBadgeLabel(task, recurrencesById) {
  if (!task.is_recurring) return null
  if (task.recurrence_id && recurrencesById[task.recurrence_id]) {
    return describeDays(recurrencesById[task.recurrence_id].days_of_week)
  }
  return task.recurrence_type || 'recurring'
}

const STATUS_STYLE = {
  approved:  { bg: '#dcfce7', color: '#16a34a', label: 'Done' },
  submitted: { bg: '#dbeafe', color: '#2563eb', label: 'Review' },
  rejected:  { bg: '#fee2e2', color: '#dc2626', label: 'Redo' },
  pending:   { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
}

// ── Timeline constants ────────────────────────────────────────
const HOUR_START  = 6    // 6 AM
const HOUR_END    = 22   // 10 PM
const SLOT_HEIGHT = 48   // px per half-hour row (96px per full hour)
const TIME_COL_W  = 60   // px for time gutter
const KID_COL_MIN = 160  // px min per kid column

function buildHourSlots() {
  const slots = []
  for (let h = HOUR_START; h < HOUR_END; h++) {
    slots.push(String(h).padStart(2, '0') + ':00')
    slots.push(String(h).padStart(2, '0') + ':30')
  }
  return slots
}
function fmtSlot(slot) {
  const [hStr, mStr] = slot.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  if (m === 0) return `${h12} ${suffix}`
  return `${h12}:30 ${suffix}`
}
// For audit/toast labels — same as fmtSlot
function fmtHour(slot) { return fmtSlot(slot) }

function slotForTask(task) {
  if (!task.due_time) return 'anytime'
  const [hStr, mStr] = task.due_time.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr || '0', 10)
  if (h < HOUR_START || h >= HOUR_END) return 'anytime'
  // Round to nearest :00 or :30
  const roundedM = m < 15 ? '00' : m < 45 ? '30' : '00'
  const roundedH = m >= 45 ? h + 1 : h
  if (roundedH >= HOUR_END) return 'anytime'
  return String(roundedH).padStart(2, '0') + ':' + roundedM
}

// ── Shared: Draggable template card ──────────────────────────
function DraggableTemplate({ tpl }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tpl.id, data: { type: 'template', tpl } })
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

// ── Task Bank panel — desktop (grouped by category) ──────────
function TaskBankPanel({ templates }) {
  const [collapsed, setCollapsed] = useState({})

  const grouped = CATEGORIES
    .map(cat => ({
      ...cat,
      tasks: templates.filter(t => (t.category || 'Other') === cat.id),
    }))
    .filter(g => g.tasks.length > 0)

  return (
    <div style={{ width: '260px', flexShrink: 0, paddingLeft: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0' }}>
      <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px', textTransform: 'uppercase', margin: '0 0 12px' }}>
        Task Bank
      </h2>
      {templates.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '2px dashed #e5e7eb' }}>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>No tasks yet.</p>
          <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px' }}>Add some in Task Bank.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {grouped.map(group => {
            const isOpen = !collapsed[group.id]
            return (
              <div key={group.id}>
                {/* Category header */}
                <button
                  onClick={() => setCollapsed(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 8px', borderRadius: '8px', border: 'none',
                    background: group.bg, cursor: 'pointer', marginBottom: isOpen ? '6px' : '0',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{group.emoji}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: group.color, flex: 1, textAlign: 'left' }}>
                    {group.label}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: group.color, background: 'rgba(255,255,255,0.7)', borderRadius: '99px', padding: '1px 6px' }}>
                    {group.tasks.length}
                  </span>
                  <ChevronDown
                    size={12}
                    color={group.color}
                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}
                  />
                </button>
                {/* Task cards */}
                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {group.tasks.map(tpl => <DraggableTemplate key={tpl.id} tpl={tpl} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Task Bank panel — mobile (category tabs + scrollable strip) ──
function TaskBankMobile({ templates }) {
  // Build groups, keep only non-empty ones
  const groups = CATEGORIES
    .map(cat => ({ ...cat, tasks: templates.filter(t => (t.category || 'Other') === cat.id) }))
    .filter(g => g.tasks.length > 0)

  const [activeCat, setActiveCat] = useState(null)

  // Default to first available category
  const resolvedCat = activeCat && groups.find(g => g.id === activeCat)
    ? activeCat
    : groups[0]?.id

  const visibleTasks = groups.find(g => g.id === resolvedCat)?.tasks || templates

  if (templates.length === 0) {
    return (
      <div style={{ flexShrink: 0, borderTop: '1px solid #f3f4f6', padding: '12px 16px 8px' }}>
        <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>No tasks yet.</p>
      </div>
    )
  }

  return (
    <div style={{ flexShrink: 0, borderTop: '2px solid #e5e7eb', background: '#fff' }}>
      {/* Category tab bar */}
      <div style={{
        display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 12px 6px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {groups.map(g => {
          const active = g.id === resolvedCat
          return (
            <button
              key={g.id}
              onPointerDown={e => { e.stopPropagation(); setActiveCat(g.id) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                padding: '5px 10px', borderRadius: '99px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600,
                background: active ? '#6366f1' : '#f3f4f6',
                color: active ? '#fff' : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              <span>{g.emoji}</span>
              {g.label}
              <span style={{
                fontSize: '10px', fontWeight: 700,
                background: active ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
                color: active ? '#fff' : '#9ca3af',
                borderRadius: '99px', padding: '1px 5px', marginLeft: '1px',
              }}>{g.tasks.length}</span>
            </button>
          )
        })}
      </div>

      {/* Task strip for active category */}
      <div style={{
        display: 'flex', gap: '8px', overflowX: 'auto',
        padding: '4px 12px 12px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {visibleTasks.map(tpl => <DraggableTemplateMobile key={tpl.id} tpl={tpl} />)}
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
// HOURLY TIMELINE (replaces old Daily View)
// ══════════════════════════════════════════════════════════════

function TimelineTaskBlock({ task, onDelete, kidColor }) {
  const [hovered, setHovered] = useState(false)
  const st = STATUS_STYLE[task.status] || STATUS_STYLE.pending
  const canDrag = task.status === 'pending'
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `assignment__${task.id}`,
    data: { type: 'assignment', assignment: task },
    disabled: !canDrag,
  })
  return (
    <div
      ref={setNodeRef}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 8px', borderRadius: '8px', marginBottom: '3px',
        background: isDragging ? kidColor + '30' : '#fff',
        borderLeft: `3px solid ${kidColor}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        maxHeight: SLOT_HEIGHT - 10 + 'px',
        overflow: 'hidden', position: 'relative',
        cursor: canDrag ? 'grab' : 'default',
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
      }}
    >
      <span style={{ fontSize: '13px', flexShrink: 0 }}>{task.icon}</span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {task._recurLabel && (
        <span title={`Repeats ${task._recurLabel}`} style={{ fontSize: '10px', flexShrink: 0 }}>🔁</span>
      )}
      {!task.due_time && (
        <span title="No time set" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '99px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', flexShrink: 0 }}>
          <Clock size={8} /> No time
        </span>
      )}
      <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '99px', background: st.bg, color: st.color, flexShrink: 0 }}>
        {st.label}
      </span>
      {hovered && (
        <button
          onClick={() => onDelete(task)}
          style={{ padding: '2px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', color: '#ef4444', display: 'flex', flexShrink: 0 }}
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}

function TimelineSlotDroppable({ kidId, hourSlot, tasks, onDelete, isOver, kidColor }) {
  const { setNodeRef } = useDroppable({ id: `${kidId}__${hourSlot}` })
  const slotTasks = tasks.filter(t => t.kid_id === kidId && slotForTask(t) === hourSlot)
  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1, minWidth: KID_COL_MIN + 'px',
        height: hourSlot === 'anytime' ? undefined : SLOT_HEIGHT + 'px',
        minHeight: hourSlot === 'anytime' ? '52px' : undefined,
        padding: '4px 6px',
        background: isOver ? kidColor + '20' : 'transparent',
        borderRight: '1px solid #f3f4f6',
        borderBottom: '1px solid #f3f4f6',
        transition: 'background 0.12s',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {slotTasks.length === 0 ? (
        isOver ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: kidColor, fontWeight: 600 }}>+ Drop here</span>
          </div>
        ) : null
      ) : (
        <>
          {slotTasks.slice(0, 2).map(t => (
            <TimelineTaskBlock key={t.id} task={t} onDelete={onDelete} kidColor={kidColor} />
          ))}
          {slotTasks.length > 2 && (
            <span style={{ fontSize: '10px', color: '#9ca3af', paddingLeft: '4px' }}>+{slotTasks.length - 2} more</span>
          )}
        </>
      )}
    </div>
  )
}

function KidColHeader({ kid }) {
  return (
    <div style={{
      flex: 1, minWidth: KID_COL_MIN + 'px',
      padding: '10px 12px',
      background: kid.avatar_color + '15',
      borderBottom: `2px solid ${kid.avatar_color}40`,
      borderRight: '1px solid #f3f4f6',
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      <span style={{ fontSize: '18px' }}>{kid.avatar_emoji}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{kid.name}</span>
    </div>
  )
}

function AnytimeRow({ kids, tasks, onDelete, overId }) {
  return (
    <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb' }}>
      <div style={{
        width: TIME_COL_W + 'px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Any</span>
      </div>
      {kids.map(kid => (
        <TimelineSlotDroppable
          key={kid.id}
          kidId={kid.id}
          hourSlot="anytime"
          tasks={tasks}
          onDelete={onDelete}
          isOver={overId === `${kid.id}__anytime`}
          kidColor={kid.avatar_color}
        />
      ))}
    </div>
  )
}

function HourlyTimeline({ kids, tasks, onDelete, overId }) {
  const hourSlots = buildHourSlots()
  const now = new Date()
  const nowH = now.getHours()
  const nowM = now.getMinutes()
  // Match current time to nearest slot
  const nowSlot = nowH >= HOUR_START && nowH < HOUR_END
    ? String(nowH).padStart(2, '0') + ':' + (nowM < 30 ? '00' : '30')
    : null
  const currentRowRef = useRef(null)

  useEffect(() => {
    if (currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [])

  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0 }}>
      <div style={{ minWidth: TIME_COL_W + kids.length * KID_COL_MIN + 'px' }}>

        {/* Sticky header */}
        <div style={{
          display: 'flex', position: 'sticky', top: 0, zIndex: 10,
          background: '#fafafa', borderBottom: '1px solid #e5e7eb',
        }}>
          <div style={{ width: TIME_COL_W + 'px', flexShrink: 0 }} />
          {kids.map(kid => <KidColHeader key={kid.id} kid={kid} />)}
        </div>

        {/* Anytime row */}
        <AnytimeRow kids={kids} tasks={tasks} onDelete={onDelete} overId={overId} />

        {/* Half-hour rows */}
        {hourSlots.map((slot, idx) => {
          const isHour = slot.endsWith(':00')
          const isNow = slot === nowSlot
          return (
            <div
              key={slot}
              ref={isNow ? currentRowRef : null}
              style={{
                display: 'flex', height: SLOT_HEIGHT + 'px',
                background: isNow ? '#fffbeb' : isHour ? (Math.floor(idx / 2) % 2 === 0 ? '#fafafa' : '#fff') : (Math.floor(idx / 2) % 2 === 0 ? '#f5f5f5' : '#fafafa'),
                borderLeft: isNow ? '2px solid #f59e0b' : 'none',
                borderBottom: isHour ? '1px solid #e5e7eb' : '1px solid #f3f4f6',
              }}
            >
              {/* Time label gutter */}
              <div style={{
                width: TIME_COL_W + 'px', flexShrink: 0,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                paddingRight: '8px', paddingTop: '5px', position: 'relative',
              }}>
                {isHour ? (
                  <span style={{
                    fontSize: '11px', color: isNow ? '#f59e0b' : '#9ca3af',
                    fontWeight: isNow ? 700 : 500,
                  }}>
                    {fmtSlot(slot)}
                  </span>
                ) : (
                  /* subtle :30 tick mark */
                  <span style={{
                    fontSize: '10px', color: isNow ? '#f59e0b' : '#d1d5db',
                    fontWeight: 400, letterSpacing: 0,
                  }}>
                    :30
                  </span>
                )}
              </div>
              {/* Kid slots */}
              {kids.map(kid => (
                <TimelineSlotDroppable
                  key={kid.id}
                  kidId={kid.id}
                  hourSlot={slot}
                  tasks={tasks}
                  onDelete={onDelete}
                  isOver={overId === `${kid.id}__${slot}`}
                  kidColor={kid.avatar_color}
                />
              ))}
            </div>
          )
        })}
      </div>
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
      {task._recurLabel && <span title={`Repeats ${task._recurLabel}`} style={{ fontSize: '9px', flexShrink: 0 }}>🔁</span>}
      {!task.due_time && (
        <span title="No time set" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Clock size={9} color="#f97316" />
        </span>
      )}
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
  const [recurrences, setRecurrences] = useState([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pendingDrop, setPendingDrop] = useState(null)   // { tpl, kidId, dateStr, hourSlot }
  const [activeTemplate, setActiveTemplate] = useState(null)
  const [activeAssignment, setActiveAssignment] = useState(null)
  const [overId, setOverId] = useState(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [editingRecurrence, setEditingRecurrence] = useState(null)
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
    const [kidsRes, templatesRes, assignRes, recRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'kid').order('name'),
      supabase.from('task_templates').select('*').order('title'),
      supabase
        .from('task_assignments')
        .select('*')
        .gte('due_date', weekStartStr)
        .lte('due_date', weekEndStr)
        .order('created_at'),
      supabase.from('task_recurrences').select('*').eq('active', true).order('created_at'),
    ])
    setKids(kidsRes.data || [])
    setTemplates(templatesRes.data || [])
    setAssignments(assignRes.data || [])
    setRecurrences(recRes.data || [])
  }, [profile.id, weekStartStr, weekEndStr])

  useEffect(() => { load() }, [load])

  const recurrencesById = useMemo(() => {
    const map = {}
    for (const r of recurrences) map[r.id] = r
    return map
  }, [recurrences])

  const labeledAssignments = useMemo(
    () => assignments.map(a => ({ ...a, _recurLabel: recurrenceBadgeLabel(a, recurrencesById) })),
    [assignments, recurrencesById]
  )

  function handleDrop(kidId, dateStr, tpl, hourSlot = 'anytime') {
    // Stage the drop — show recurrence picker before inserting
    setPendingDrop({ tpl, kidId, dateStr, hourSlot })
  }

  async function confirmDrop(selectedDays) {
    if (!pendingDrop) return
    const { tpl, kidId, dateStr, hourSlot } = pendingDrop
    setPendingDrop(null)
    const dueTime = hourSlot === 'anytime' ? null : hourSlot
    const kid = kids.find(k => k.id === kidId)

    if (!selectedDays.length) {
      // One-time task — no series involved.
      const { error } = await supabase.from('task_assignments').insert({
        template_id: tpl.id,
        kid_id: kidId,
        title: tpl.title,
        description: tpl.description || null,
        credit_value: tpl.credit_value,
        icon: tpl.icon,
        due_date: dateStr,
        due_time: dueTime,
        created_by: profile.id,
      })
      if (!error) {
        const timeLabel = hourSlot === 'anytime' ? '' : ` at ${fmtHour(hourSlot)}`
        toast.success(`${tpl.icon} assigned!`)
        logAction(profile, 'Task assigned', 'task', `"${tpl.title}" → ${kid?.name || kidId} on ${dateStr}${timeLabel}`)
        load()
      } else toast.error(error.message)
      return
    }

    // Recurring — create the series record first, then pre-populate the
    // visible window from it. morning-agent extends it day by day after that.
    const { data: recurrence, error: recErr } = await supabase
      .from('task_recurrences')
      .insert({
        template_id: tpl.id,
        kid_id: kidId,
        title: tpl.title,
        description: tpl.description || null,
        credit_value: tpl.credit_value,
        icon: tpl.icon,
        due_time: dueTime,
        days_of_week: selectedDays,
        created_by: profile.id,
      })
      .select()
      .single()
    if (recErr) { toast.error(recErr.message); return }

    const dates = datesForWindow(dateStr, selectedDays, 28)
    const rows = dates.map(d => ({
      template_id: tpl.id,
      kid_id: kidId,
      title: tpl.title,
      description: tpl.description || null,
      credit_value: tpl.credit_value,
      icon: tpl.icon,
      due_date: d,
      due_time: dueTime,
      is_recurring: true,
      recurrence_id: recurrence.id,
      created_by: profile.id,
    }))

    const { error } = await supabase.from('task_assignments').insert(rows)
    if (!error) {
      const dayLabel = describeDays(selectedDays)
      toast.success(`${tpl.icon} assigned · repeats ${dayLabel}!`)
      logAction(profile, 'Task assigned', 'task', `"${tpl.title}" → ${kid?.name || kidId} starting ${dateStr}, repeats ${dayLabel} (${dates.length} dates)`)
      load()
    } else toast.error(error.message)
  }

  async function cancelRecurrence(recurrence) {
    await supabase.from('task_recurrences').update({ active: false }).eq('id', recurrence.id)
    await supabase.from('task_assignments')
      .delete()
      .eq('recurrence_id', recurrence.id)
      .eq('status', 'pending')
      .gte('due_date', today)
    const kid = kids.find(k => k.id === recurrence.kid_id)
    toast.success(`"${recurrence.title}" recurring schedule cancelled`)
    logAction(profile, 'Recurring task cancelled', 'task', `"${recurrence.title}" for ${kid?.name || recurrence.kid_id}`)
    load()
  }

  async function saveRecurrenceEdit(recurrence, newDays, newCreditValue) {
    const { error: updErr } = await supabase
      .from('task_recurrences')
      .update({ days_of_week: newDays, credit_value: newCreditValue })
      .eq('id', recurrence.id)
    if (updErr) { toast.error(updErr.message); return }

    // Clear out not-yet-done future instances generated under the old
    // pattern, then regenerate the window against the new one.
    await supabase.from('task_assignments')
      .delete()
      .eq('recurrence_id', recurrence.id)
      .eq('status', 'pending')
      .gte('due_date', today)

    const dates = datesForWindow(today, newDays, 28)
    if (dates.length) {
      const rows = dates.map(d => ({
        template_id: recurrence.template_id,
        kid_id: recurrence.kid_id,
        title: recurrence.title,
        description: recurrence.description,
        credit_value: newCreditValue,
        icon: recurrence.icon,
        due_date: d,
        due_time: recurrence.due_time,
        is_recurring: true,
        recurrence_id: recurrence.id,
        created_by: profile.id,
      }))
      await supabase.from('task_assignments').insert(rows)
    }

    const kid = kids.find(k => k.id === recurrence.kid_id)
    toast.success('Recurring schedule updated')
    logAction(profile, 'Recurring task updated', 'task', `"${recurrence.title}" for ${kid?.name || recurrence.kid_id} → repeats ${describeDays(newDays)}`)
    setEditingRecurrence(null)
    load()
  }

  async function handleMove(assignment, kidId, dateStr, hourSlot) {
    const newTime = hourSlot === 'anytime' ? null : hourSlot
    if (assignment.due_time === newTime && assignment.kid_id === kidId && assignment.due_date === dateStr) return
    const { error } = await supabase
      .from('task_assignments')
      .update({ due_time: newTime, kid_id: kidId, due_date: dateStr })
      .eq('id', assignment.id)
    if (!error) {
      const kid = kids.find(k => k.id === kidId)
      const timeLabel = hourSlot === 'anytime' ? 'anytime' : fmtHour(hourSlot)
      toast.success(`Moved to ${timeLabel}`)
      logAction(profile, 'Task rescheduled', 'task', `"${assignment.title}" → ${kid?.name} at ${timeLabel}`)
      load()
    } else toast.error(error.message)
  }

  function onDragEnd({ active, over }) {
    setActiveTemplate(null)
    setActiveAssignment(null)
    setOverId(null)
    if (!over) return

    const { type, tpl, assignment } = active.data.current || {}

    if (type === 'assignment' && assignment) {
      if (view === 'daily') {
        const parts = over.id.split('__')
        handleMove(assignment, parts[0], selectedDate, parts[1] || 'anytime')
      } else {
        const [kidId, dateStr] = over.id.split('__')
        handleMove(assignment, kidId, dateStr, 'anytime')
      }
      return
    }

    if (!tpl) return
    const overId = over.id
    if (view === 'daily') {
      const parts = overId.split('__')
      handleDrop(parts[0], selectedDate, tpl, parts[1] || 'anytime')
    } else {
      const [kidId, dateStr] = overId.split('__')
      handleDrop(kidId, dateStr, tpl)
    }
  }

  async function handleDeleteOne() {
    const { error } = await supabase.from('task_assignments').delete().eq('id', deleteTarget.id)
    if (!error) {
      toast.success('Task removed')
      logAction(profile, 'Task removed', 'task', `"${deleteTarget.title}" on ${deleteTarget.due_date}`)
      load()
    }
    setDeleteTarget(null)
  }

  async function handleDeleteSeries() {
    const recurrence = recurrencesById[deleteTarget.recurrence_id]
    if (recurrence) {
      await cancelRecurrence(recurrence)
    } else {
      // No linked series record (a leftover from before the recurring redesign) — just this row.
      await supabase.from('task_assignments').delete().eq('id', deleteTarget.id)
      load()
    }
    setDeleteTarget(null)
  }

  function getOverCellId() {
    if (!overId || view === 'daily') return null
    return overId // `${kidId}__${dateStr}`
  }

  const dailyAssignments = labeledAssignments.filter((a) => a.due_date === selectedDate)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: isMobile ? '16px 16px 0' : '28px 40px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.4px' }}>Schedule</h1>
            {!isMobile && <p style={{ fontSize: '14px', color: '#9ca3af', margin: '4px 0 0' }}>Drag tasks onto kids to assign them</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setManagerOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: isMobile ? '7px 10px' : '7px 14px', borderRadius: '10px',
                border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, color: '#374151',
              }}
            >
              <RefreshCw size={14} />{!isMobile && ' Recurring'}
            </button>
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
            <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#94a3b8' }}>
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
        collisionDetection={pointerWithin}
        onDragStart={({ active }) => {
          const { type, tpl, assignment } = active.data.current || {}
          setActiveTemplate(type === 'template' ? tpl : (tpl || null))
          setActiveAssignment(type === 'assignment' ? assignment : null)
        }}
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
            // ── Hourly Timeline ──────────────────────────────────────
            <HourlyTimeline
              kids={kids}
              tasks={dailyAssignments}
              onDelete={setDeleteTarget}
              overId={overId}
            />
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
                            <span style={{ fontSize: '18px', fontWeight: 700, color: isToday ? '#818cf8' : '#94a3b8' }}>{format(day, 'd')}</span>
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
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{kid.name}</span>
                        </div>
                      </td>
                      {/* Day cells */}
                      {weekDays.map((day) => {
                        const dayStr = format(day, 'yyyy-MM-dd')
                        const cellId = `${kid.id}__${dayStr}`
                        const cellTasks = labeledAssignments.filter((a) => a.kid_id === kid.id && a.due_date === dayStr)
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
          {activeAssignment ? <OverlayCard tpl={activeAssignment} /> : null}
        </DragOverlay>
      </DndContext>

      {deleteTarget && (
        deleteTarget.recurrence_id ? (
          <DeleteOccurrenceDialog
            target={deleteTarget}
            onDeleteOne={handleDeleteOne}
            onDeleteSeries={handleDeleteSeries}
            onCancel={() => setDeleteTarget(null)}
          />
        ) : (
          <ConfirmDialog
            message={`Remove "${deleteTarget.title}"?`}
            onConfirm={handleDeleteOne}
            onCancel={() => setDeleteTarget(null)}
            confirmLabel="Remove"
          />
        )
      )}

      {pendingDrop && (
        <RecurrencePicker
          drop={pendingDrop}
          kids={kids}
          onConfirm={confirmDrop}
          onCancel={() => setPendingDrop(null)}
        />
      )}

      {managerOpen && (
        <RecurringManager
          recurrences={recurrences}
          kids={kids}
          onClose={() => setManagerOpen(false)}
          onEdit={(r) => setEditingRecurrence(r)}
          onCancelSeries={cancelRecurrence}
        />
      )}

      {editingRecurrence && (
        <EditRecurrenceModal
          recurrence={editingRecurrence}
          kids={kids}
          onSave={saveRecurrenceEdit}
          onCancel={() => setEditingRecurrence(null)}
        />
      )}
    </div>
  )
}

// ── Day-of-week picker — shared by the create flow and the editor ──
function DayOfWeekPicker({ selected, onChange, accentColor }) {
  const c = accentColor || '#6366f1'
  const isEveryDay = selected.length === 7
  const isWeekdays = selected.length === 5 && [1, 2, 3, 4, 5].every(d => selected.includes(d))

  function toggleDay(d) {
    onChange(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d].sort((a, b) => a - b))
  }

  function presetBtn(label, active, onClick) {
    return (
      <button
        onClick={onClick}
        style={{
          flex: 1, padding: '8px 6px', borderRadius: '9px', border: 'none', cursor: 'pointer',
          fontSize: '12px', fontWeight: 600,
          background: active ? c : 'rgba(255,255,255,0.06)',
          color: active ? '#fff' : '#94a3b8',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {presetBtn('One-time', selected.length === 0, () => onChange([]))}
        {presetBtn('Weekdays', isWeekdays, () => onChange([1, 2, 3, 4, 5]))}
        {presetBtn('Every day', isEveryDay, () => onChange([0, 1, 2, 3, 4, 5, 6]))}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {DAY_LETTERS.map((letter, d) => {
          const active = selected.includes(d)
          return (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              title={DAY_NAMES[d]}
              style={{
                flex: 1, aspectRatio: '1', borderRadius: '9px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 700,
                background: active ? c : 'rgba(255,255,255,0.06)',
                color: active ? '#fff' : '#64748b',
                boxShadow: active ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
              }}
            >
              {letter}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Recurrence Picker Modal ──────────────────────────────────
function RecurrencePicker({ drop, kids, onConfirm, onCancel }) {
  const [selected, setSelected] = useState([])
  const kid = kids.find(k => k.id === drop.kidId)
  const c = kid?.avatar_color || '#6366f1'
  const dateLabel = format(new Date(drop.dateStr + 'T12:00:00'), 'EEEE, MMM d')
  const timeLabel = drop.hourSlot === 'anytime' ? '' : ` · ${drop.hourSlot}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={onCancel} />
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '380px',
        background: 'rgba(10,18,40,0.98)',
        border: `1px solid ${c}40`,
        borderRadius: '20px',
        boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px ${c}20`,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: `linear-gradient(135deg, ${c}18, transparent)` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '26px' }}>{drop.tpl.icon}</span>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{drop.tpl.title}</p>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                  → {kid?.avatar_emoji} {kid?.name} · {dateLabel}{timeLabel}
                </p>
              </div>
            </div>
            <button onClick={onCancel} style={{ padding: '5px', borderRadius: '7px', border: 'none', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} color="#60a5fa" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#93c5fd' }}>How often should this repeat?</span>
          </div>
        </div>

        {/* Day picker */}
        <div style={{ padding: '16px' }}>
          <DayOfWeekPicker selected={selected} onChange={setSelected} accentColor={c} />
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px 16px', display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: c, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            Assign {selected.length > 0 ? '🔁' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Recurring Tasks manager ──────────────────────────────────
// ── Delete dialog for a single occurrence that belongs to a series ──
function DeleteOccurrenceDialog({ target, onDeleteOne, onDeleteSeries, onCancel }) {
  const dateLabel = format(new Date(target.due_date + 'T12:00:00'), 'EEEE, MMM d')
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', width: '100%', maxWidth: '400px', padding: '28px 24px 24px' }}>
        <p style={{ fontSize: '15px', color: '#374151', textAlign: 'center', margin: '0 0 6px', lineHeight: 1.5 }}>
          "{target.title}" repeats. What do you want to remove?
        </p>
        <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', margin: '0 0 20px' }}>
          {dateLabel}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={onDeleteSeries}
            style={{ padding: '11px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            This and all future occurrences
          </button>
          <button
            onClick={onDeleteOne}
            style={{ padding: '11px', borderRadius: '10px', border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Just this day
          </button>
          <button
            onClick={onCancel}
            style={{ padding: '11px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function RecurringManager({ recurrences, kids, onClose, onEdit, onCancelSeries }) {
  const [confirmTarget, setConfirmTarget] = useState(null)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(10,18,40,0.98)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} color="#60a5fa" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>Recurring Tasks</span>
          </div>
          <button onClick={onClose} style={{ padding: '5px', borderRadius: '7px', border: 'none', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '12px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recurrences.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
              No recurring tasks yet. Drop a task on the schedule and pick some days to start one.
            </p>
          ) : recurrences.map(r => {
            const kid = kids.find(k => k.id === r.kid_id)
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                borderRadius: '12px', background: 'rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{r.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>
                    {kid?.avatar_emoji} {kid?.name || '—'} · repeats {describeDays(r.days_of_week)} · +{r.credit_value} cr
                  </p>
                </div>
                <button
                  onClick={() => onEdit(r)}
                  style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.06)', color: '#93c5fd', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setConfirmTarget(r)}
                  style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.06)', color: '#f87171', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {confirmTarget && (
        <ConfirmDialog
          message={`Cancel the recurring "${confirmTarget.title}"? This removes all of its not-yet-done future occurrences. Completed ones stay in history.`}
          confirmLabel="Cancel series"
          onConfirm={() => { onCancelSeries(confirmTarget); setConfirmTarget(null) }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}

// ── Edit Recurrence Modal ─────────────────────────────────────
function EditRecurrenceModal({ recurrence, kids, onSave, onCancel }) {
  const [days, setDays] = useState(recurrence.days_of_week)
  const [creditValue, setCreditValue] = useState(recurrence.credit_value)
  const kid = kids.find(k => k.id === recurrence.kid_id)
  const c = kid?.avatar_color || '#6366f1'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={onCancel} />
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px',
        background: 'rgba(10,18,40,0.98)', border: `1px solid ${c}40`, borderRadius: '20px',
        boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px ${c}20`, overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: `linear-gradient(135deg, ${c}18, transparent)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>{recurrence.icon}</span>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{recurrence.title}</p>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                → {kid?.avatar_emoji} {kid?.name}
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd', margin: '0 0 8px' }}>Repeats on</p>
            <DayOfWeekPicker selected={days} onChange={setDays} accentColor={c} />
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd', margin: '0 0 8px' }}>Credits per completion</p>
            <input
              type="number"
              min={1}
              value={creditValue}
              onChange={e => setCreditValue(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)',
                color: '#f1f5f9', fontSize: '14px', boxSizing: 'border-box',
              }}
            />
          </div>
          {days.length === 0 && (
            <p style={{ fontSize: '11px', color: '#f59e0b', margin: 0 }}>
              Pick at least one day — to stop this task entirely, cancel it from the Recurring Tasks list instead.
            </p>
          )}
        </div>

        <div style={{ padding: '12px 16px 16px', display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={days.length === 0}
            onClick={() => onSave(recurrence, days, creditValue)}
            style={{
              flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
              background: days.length === 0 ? 'rgba(255,255,255,0.1)' : c,
              color: days.length === 0 ? '#64748b' : '#fff',
              fontSize: '14px', fontWeight: 700, cursor: days.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
