import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { Star, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { logAction } from '../../lib/audit'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ParentInsights() {
  const { profile } = useAuth()
  const [kids, setKids] = useState([])
  const [kidWeekStats, setKidWeekStats] = useState({})   // kid_id → { credits, completed, total }
  const [taskRates, setTaskRates] = useState([])          // { template_id, title, icon, total, completed }
  const [dailyCredits, setDailyCredits] = useState([])    // { day, kid_id, credits }
  const [ledger, setLedger] = useState([])                // all ledger entries last 30 days
  const [selectedKid, setSelectedKid] = useState(null)   // kid_id filter for ledger
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
  const sevenDaysAgo  = format(subDays(new Date(), 6), 'yyyy-MM-dd')

  async function load() {
    setLoading(true)

    const [kidsRes, assignmentsRes, ledgerWeekRes, ledgerDailyRes, ledgerAllRes] = await Promise.all([
      // All kids
      supabase.from('profiles').select('id, name, avatar_emoji, avatar_color').eq('role', 'kid').order('name'),

      // All assignments last 30 days with template info
      supabase
        .from('task_assignments')
        .select('id, kid_id, template_id, title, icon, status, due_date')
        .gte('due_date', thirtyDaysAgo)
        .lte('due_date', today),

      // Credits earned last 7 days (positive entries only)
      supabase
        .from('credit_ledger')
        .select('kid_id, amount, created_at')
        .gte('created_at', sevenDaysAgo)
        .gt('amount', 0),

      // Credits per day last 7 days
      supabase
        .from('credit_ledger')
        .select('kid_id, amount, created_at')
        .gte('created_at', sevenDaysAgo)
        .gt('amount', 0),

      // Full ledger last 30 days (for credit breakdown)
      supabase
        .from('credit_ledger')
        .select('*')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false }),
    ])

    const kidsData = kidsRes.data || []
    setKids(kidsData)
    setLedger(ledgerAllRes.data || [])
    setSelectedKid(prev => prev || kidsData[0]?.id || null)

    // ── Kid week stats ──────────────────────────────────────────
    const statsMap = {}
    for (const k of kidsData) {
      statsMap[k.id] = { credits: 0, completed: 0, total: 0 }
    }
    // Credits last 7 days
    for (const entry of (ledgerWeekRes.data || [])) {
      if (statsMap[entry.kid_id]) statsMap[entry.kid_id].credits += entry.amount
    }
    // Tasks last 7 days
    for (const a of (assignmentsRes.data || []).filter(a => a.due_date >= sevenDaysAgo)) {
      if (statsMap[a.kid_id]) {
        statsMap[a.kid_id].total++
        if (a.status === 'approved') statsMap[a.kid_id].completed++
      }
    }
    setKidWeekStats(statsMap)

    // ── Task completion rates (last 30 days) ───────────────────
    const rateMap = {}
    for (const a of (assignmentsRes.data || [])) {
      if (!a.template_id) continue
      if (!rateMap[a.template_id]) rateMap[a.template_id] = { template_id: a.template_id, title: a.title, icon: a.icon, total: 0, completed: 0 }
      rateMap[a.template_id].total++
      if (a.status === 'approved') rateMap[a.template_id].completed++
    }
    const rates = Object.values(rateMap)
      .filter(r => r.total >= 2)
      .sort((a, b) => b.total - a.total)
    setTaskRates(rates)

    // ── Daily credits last 7 days ──────────────────────────────
    const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'))
    const dailyMap = {}
    for (const d of days) {
      for (const k of kidsData) {
        dailyMap[`${d}__${k.id}`] = 0
      }
    }
    for (const entry of (ledgerDailyRes.data || [])) {
      const d = entry.created_at.slice(0, 10)
      const key = `${d}__${entry.kid_id}`
      if (dailyMap[key] !== undefined) dailyMap[key] += entry.amount
    }
    const dailyArr = []
    for (const d of days) {
      for (const k of kidsData) {
        dailyArr.push({ day: d, kid_id: k.id, credits: dailyMap[`${d}__${k.id}`] || 0 })
      }
    }
    setDailyCredits(dailyArr)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSendSummary() {
    if (sending) return
    setSending(true)
    try {
      // Fetch parent IDs
      const { data: parents, error: parentsErr } = await supabase
        .from('profiles').select('id').eq('role', 'parent')
      if (parentsErr) throw parentsErr
      if (!parents?.length) {
        toast.error('No parents found')
        setSending(false)
        return
      }

      const weekLabel = `${format(subDays(new Date(), 6), 'MMM d')}–${format(new Date(), 'MMM d')}`
      const subject = `📊 Tasky Summary — Last 7 Days (${weekLabel})`

      // Build HTML email
      const kidRows = kids.map(k => {
        const s = kidWeekStats[k.id] || {}
        const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0
        const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
        const c = k.avatar_color || '#6366f1'
        return `
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #f3f4f6;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="44">
                    <div style="width:40px;height:40px;border-radius:50%;background:${c}25;border:2px solid ${c}60;display:flex;align-items:center;justify-content:center;font-size:22px;text-align:center;line-height:40px;">${k.avatar_emoji}</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#111827;">${k.name}</p>
                    <p style="margin:0;font-size:13px;color:#6b7280;">
                      ⭐ <strong style="color:#111827;">${s.credits || 0}</strong> credits earned &nbsp;·&nbsp;
                      ${s.completed || 0}/${s.total || 0} tasks &nbsp;·&nbsp;
                      <strong style="color:${barColor};">${pct}% complete</strong>
                    </p>
                    <div style="margin-top:8px;height:6px;background:#f3f4f6;border-radius:99px;overflow:hidden;">
                      <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;"></div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      }).join('')

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1e3a5f,#1e40af);padding:28px 32px;">
              <p style="margin:0 0 4px;font-size:22px;">✅ Tasky</p>
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;">Weekly Summary</h1>
              <p style="margin:6px 0 0;font-size:14px;color:#93c5fd;">${weekLabel}</p>
            </div>
            <!-- Kids -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${kidRows}
            </table>
            <!-- Footer -->
            <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Sent from Tasky · your family chores app</p>
            </div>
          </div>
        </body>
        </html>`

      const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-email', {
        body: { userIds: parents.map(p => p.id), subject, html },
      })
      if (emailErr) throw emailErr

      const sent = emailData?.sent ?? 0

      // Audit log
      await logAction(profile, 'send_weekly_summary', 'insights', {
        week_start: weekStartStr,
        emails_sent: sent,
        kids: kids.map(k => ({ name: k.name, credits: kidWeekStats[k.id]?.credits || 0 })),
      })

      if (sent === 0) {
        toast('No parent email addresses found', { icon: '⚠️', duration: 5000 })
      } else {
        toast.success(`📧 Weekly summary emailed to ${sent} parent${sent > 1 ? 's' : ''}!`)
      }
    } catch (err) {
      console.error('Send summary error:', err)
      toast.error('Failed to send email — check console for details')
    }
    setSending(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
      <div style={{ width: '28px', height: '28px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  // Max credits in daily chart for scaling
  const days7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'))
  const maxDayCredits = Math.max(1, ...dailyCredits.map(d => d.credits))

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 56px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Insights</h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Track performance, spot patterns, celebrate progress.</p>
        </div>
        <button
          onClick={handleSendSummary}
          disabled={sending}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: sending ? 0.7 : 1 }}
        >
          <Mail size={14} /> {sending ? 'Sending…' : 'Email Weekly Summary'}
        </button>
      </div>

      {/* ── Last 7 Days: Kid Cards ── */}
      <Section title="Last 7 Days" subtitle={`${format(subDays(new Date(), 6), 'MMM d')} – ${format(new Date(), 'MMM d')}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
          {kids.map(kid => {
            const s = kidWeekStats[kid.id] || { credits: 0, completed: 0, total: 0 }
            const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0
            const c = kid.avatar_color || '#6366f1'
            return (
              <div key={kid.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {/* Kid header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: c + '25', border: `2px solid ${c}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                    {kid.avatar_emoji}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{kid.name}</span>
                </div>

                {/* Credits */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
                  <Star size={14} fill="#f59e0b" color="#f59e0b" />
                  <span style={{ fontSize: '22px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{s.credits}</span>
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>credits earned</span>
                </div>

                {/* Completion bar */}
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444', borderRadius: '99px', transition: 'width 0.6s ease' }} />
                  </div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>
                    {s.completed}/{s.total} tasks · <strong style={{ color: pct >= 80 ? '#16a34a' : pct >= 50 ? '#b45309' : '#b91c1c' }}>{pct}%</strong>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Daily Credits Chart (last 7 days) ── */}
      <Section title="Daily Credits" subtitle="Last 7 days">
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {kids.map(k => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: k.avatar_color || '#6366f1' }} />
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{k.name}</span>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
            {days7.map((day, di) => {
              const dayLabel = DAYS[new Date(day + 'T12:00:00').getDay()]
              const isToday = day === today
              return (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
                  {/* Stacked bars */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '2px', flex: 1 }}>
                    {kids.map(k => {
                      const entry = dailyCredits.find(d => d.day === day && d.kid_id === k.id)
                      const credits = entry?.credits || 0
                      const heightPct = (credits / maxDayCredits) * 100
                      return (
                        <div
                          key={k.id}
                          title={`${k.name}: ${credits} credits`}
                          style={{
                            width: '100%',
                            height: `${Math.max(credits > 0 ? 4 : 0, heightPct)}%`,
                            background: k.avatar_color || '#6366f1',
                            borderRadius: '3px',
                            opacity: isToday ? 1 : 0.75,
                            transition: 'height 0.4s ease',
                            minHeight: credits > 0 ? '4px' : '0',
                          }}
                        />
                      )
                    })}
                  </div>
                  {/* Day label */}
                  <span style={{ fontSize: '10px', fontWeight: isToday ? 700 : 400, color: isToday ? '#6366f1' : '#9ca3af' }}>
                    {isToday ? 'Today' : dayLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── Task Completion Rates ── */}
      <Section title="Task Completion Rates" subtitle="Last 30 days · min. 2 assignments">
        {taskRates.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '28px', margin: '0 0 8px' }}>📊</p>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Not enough data yet — assign more tasks to see patterns.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {taskRates.map((t, i) => {
              const pct = Math.round((t.completed / t.total) * 100)
              const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
              const badge = pct >= 80
                ? { icon: <CheckCircle size={12} />, label: 'Consistent', bg: '#dcfce7', color: '#15803d' }
                : pct < 40
                ? { icon: <AlertTriangle size={12} />, label: 'Low effort', bg: '#fee2e2', color: '#b91c1c' }
                : null
              return (
                <div key={t.template_id} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 20px',
                  borderBottom: i < taskRates.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>{t.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{t.title}</span>
                      {badge && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '99px', background: badge.bg, color: badge.color, flexShrink: 0 }}>
                          {badge.icon} {badge.label}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '99px', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: barColor, flexShrink: 0, minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{t.completed}/{t.total}</p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>completed</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ── Credit Ledger ── */}
      <Section title="Credit Ledger" subtitle="Last 30 days">
        {/* Kid tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {kids.map(k => {
            const isSelected = selectedKid === k.id
            const c = k.avatar_color || '#6366f1'
            const filtered = ledger.filter(e => e.kid_id === k.id)
            const balance = filtered.reduce((s, e) => s + e.amount, 0)
            return (
              <button
                key={k.id}
                onClick={() => setSelectedKid(k.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '7px 14px', borderRadius: '99px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
                  background: isSelected ? c : 'rgba(255,255,255,0.06)',
                  color: isSelected ? '#fff' : '#94a3b8',
                  boxShadow: isSelected ? `0 2px 8px ${c}50` : 'none',
                }}
              >
                <span>{k.avatar_emoji}</span>
                <span>{k.name}</span>
                <span style={{
                  fontSize: '11px', fontWeight: 700,
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  padding: '1px 7px', borderRadius: '99px',
                }}>
                  {balance > 0 ? '+' : ''}{balance}
                </span>
              </button>
            )
          })}
        </div>

        {/* Entries for selected kid */}
        {(() => {
          const entries = ledger.filter(e => e.kid_id === selectedKid)
          const kid = kids.find(k => k.id === selectedKid)
          if (!kid) return null
          if (entries.length === 0) return (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>No transactions in the last 30 days</p>
            </div>
          )
          const earned = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
          const spent  = entries.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0)
          const c = kid.avatar_color || '#6366f1'
          return (
            <div>
              {/* Mini summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                {[
                  { label: 'Balance', value: earned + spent, icon: <Star size={13} fill="#f59e0b" color="#f59e0b" />, color: '#f1f5f9' },
                  { label: 'Earned',  value: `+${earned}`,   icon: <TrendingUp size={13} color="#22c55e" />,          color: '#86efac' },
                  { label: 'Spent',   value: spent || 0,     icon: <TrendingDown size={13} color="#f87171" />,        color: '#fca5a5' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '3px' }}>
                      {s.icon}
                      <span style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Entry list */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {entries.map((entry, i) => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px',
                    borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                      background: entry.amount > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {entry.amount > 0
                        ? <TrendingUp size={14} color="#22c55e" />
                        : <TrendingDown size={14} color="#f87171" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.description}
                      </p>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>
                        {format(new Date(entry.created_at), 'MMM d, yyyy · h:mm a')}
                      </p>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 700, flexShrink: 0, color: entry.amount > 0 ? '#4ade80' : '#f87171' }}>
                      {entry.amount > 0 ? '+' : ''}{entry.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </Section>

    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: '44px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{title}</h2>
        {subtitle && <span style={{ fontSize: '12px', color: '#9ca3af' }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}
