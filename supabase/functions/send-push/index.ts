import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:tasky@sharabi.family', VAPID_PUBLIC, VAPID_PRIVATE)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userIds, title, body } = await req.json()
    if (!userIds?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders })

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)

    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders })

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body })
        )
      )
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ sent, total: subs.length }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
