import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    // Verify caller is a parent
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: callerProfile } = await adminClient.from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'parent')
      return new Response(JSON.stringify({ error: 'Only parents can remove users' }), { status: 403, headers: cors })

    const { userId } = await req.json()
    if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: cors })
    if (userId === caller.id)
      return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), { status: 400, headers: cors })

    // Delete from auth.users — cascades to profiles and all related data
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })

    return new Response(JSON.stringify({ success: true }), { headers: cors })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
