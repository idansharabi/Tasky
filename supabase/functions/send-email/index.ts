import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_ADDRESS    = 'Tasky <tasky@sharabi.family>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userIds, subject, html } = await req.json()
    if (!userIds?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders })
    }

    // Fetch emails from auth.users using service role
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: users, error } = await supabase.auth.admin.listUsers()
    if (error) throw error

    const emails = users.users
      .filter(u => userIds.includes(u.id) && u.email)
      .map(u => u.email!)

    if (!emails.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_emails_found' }), { headers: corsHeaders })
    }

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: emails,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Resend error ${res.status}: ${err}`)
    }

    return new Response(JSON.stringify({ sent: emails.length }), { headers: corsHeaders })
  } catch (err) {
    console.error('send-email error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
