import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { format } from 'npm:date-fns@3'

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:tasky@sharabi.family', VAPID_PUBLIC, VAPID_PRIVATE)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendPush(supabase: any, userIds: string[], title: string, body: string) {
  if (!userIds.length) return
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)
  if (!subs?.length) return
  await Promise.allSettled(
    subs.map((sub: any) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body })
      )
    )
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const dayOfWeek = new Date().getDay() // 0=Sun … 6=Sat

    // ── 1. Generate recurring tasks for today ──────────────────
    // Get recurring tasks from past assignments not yet created today
    const { data: recurring } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('is_recurring', true)
      .lt('due_date', todayStr)

    // Check which ones already exist today (avoid duplicates)
    const { data: alreadyToday } = await supabase
      .from('task_assignments')
      .select('template_id, kid_id')
      .eq('due_date', todayStr)

    const alreadySet = new Set(
      (alreadyToday || []).map((a: any) => `${a.template_id}__${a.kid_id}`)
    )

    // Deduplicate recurring templates per kid
    const seen = new Set<string>()
    const toInsert = (recurring || []).filter((t: any) => {
      const key = `${t.template_id}__${t.kid_id}`
      if (seen.has(key) || alreadySet.has(key)) return false
      if (t.recurrence_type === 'daily') { seen.add(key); return true }
      if (t.recurrence_type === 'weekdays' && dayOfWeek >= 1 && dayOfWeek <= 5) { seen.add(key); return true }
      if (t.recurrence_type === 'weekly' && new Date(t.due_date + 'T00:00:00').getDay() === dayOfWeek) { seen.add(key); return true }
      return false
    }).map((t: any) => ({
      template_id: t.template_id,
      kid_id: t.kid_id,
      title: t.title,
      description: t.description,
      credit_value: t.credit_value,
      icon: t.icon,
      due_date: todayStr,
      is_recurring: true,
      recurrence_type: t.recurrence_type,
      created_by: t.created_by,
    }))

    if (toInsert.length > 0) {
      await supabase.from('task_assignments').insert(toInsert)
    }

    // ── 2. Get all today's tasks grouped by kid ────────────────
    const { data: todayTasks } = await supabase
      .from('task_assignments')
      .select('kid_id, title')
      .eq('due_date', todayStr)

    // ── 3. Get all kids and parents ───────────────────────────
    const { data: kids } = await supabase
      .from('profiles')
      .select('id, name, avatar_emoji')
      .eq('role', 'kid')

    const { data: parents } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'parent')

    // ── 4. Notify each kid with their task count ───────────────
    const kidTaskMap: Record<string, number> = {}
    for (const t of (todayTasks || [])) {
      kidTaskMap[t.kid_id] = (kidTaskMap[t.kid_id] || 0) + 1
    }

    for (const kid of (kids || [])) {
      const count = kidTaskMap[kid.id] || 0
      if (count === 0) continue
      const greetings = ['Good morning', 'Rise and shine', 'Hey']
      const greeting = greetings[Math.floor(Math.random() * greetings.length)]
      await sendPush(
        supabase,
        [kid.id],
        `${greeting}, ${kid.name}! ${kid.avatar_emoji}`,
        count === 1
          ? `You have 1 task today. Let's get it done! 💪`
          : `You have ${count} tasks today. Let's crush them! 🔥`
      )
    }

    // ── 5. Notify parents with a summary ──────────────────────
    const totalTasks = todayTasks?.length || 0

    if (parents?.length) {
      const parentIds = parents.map((p: any) => p.id)

      const kidLines = (kids || [])
        .map((kid: any) => {
          const count = kidTaskMap[kid.id] || 0
          return count > 0 ? `${kid.avatar_emoji} ${kid.name}: ${count} task${count !== 1 ? 's' : ''}` : null
        })
        .filter(Boolean)

      const bodyText = kidLines.length > 0
        ? kidLines.join(' · ')
        : 'No tasks scheduled for today.'

      await sendPush(
        supabase,
        parentIds,
        `Good morning! ☀️ ${totalTasks} task${totalTasks !== 1 ? 's' : ''} today`,
        bodyText
      )
    }

    return new Response(
      JSON.stringify({ success: true, generated: toInsert.length, notified: (kids || []).length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('morning-agent error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
