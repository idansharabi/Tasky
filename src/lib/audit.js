import { supabase } from './supabase'

export async function logAction(profile, action, entity = null, details = null) {
  if (!profile?.id) return
  try {
    await supabase.from('audit_logs').insert({
      user_id: profile.id,
      user_name: profile.name,
      user_role: profile.role,
      action,
      entity,
      details,
    })
  } catch (err) {
    console.error('Audit log error:', err)
  }
}
