import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function TaskComments({ assignmentId }) {
  const { profile } = useAuth()
  const [comments, setComments] = useState([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  async function load() {
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`comments-${assignmentId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'task_comments',
        filter: `assignment_id=eq.${assignmentId}`,
      }, payload => setComments(prev => [...prev, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [assignmentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function handleSend(e) {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    await supabase.from('task_comments').insert({
      assignment_id: assignmentId,
      user_id: profile.id,
      user_name: profile.name,
      user_role: profile.role,
      message: message.trim(),
    })
    setMessage('')
    setSending(false)
  }

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
      {/* Comments list */}
      {comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', maxHeight: '160px', overflowY: 'auto' }}>
          {comments.map(c => {
            const isMe = c.user_id === profile.id
            const isParent = c.user_role === 'parent'
            return (
              <div key={c.id} style={{
                display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: '6px',
              }}>
                <div style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: '12px',
                  borderBottomRightRadius: isMe ? '4px' : '12px',
                  borderBottomLeftRadius: isMe ? '12px' : '4px',
                  background: isMe ? '#6366f1' : (isParent ? '#f0fdf4' : '#f3f4f6'),
                  color: isMe ? '#fff' : '#111827',
                }}>
                  {!isMe && (
                    <p style={{ fontSize: '10px', fontWeight: 700, margin: '0 0 2px',
                      color: isParent ? '#16a34a' : '#6b7280' }}>
                      {c.user_name} {isParent ? '👨‍👩‍👧' : ''}
                    </p>
                  )}
                  <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.4 }}>{c.message}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Add a comment…"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '20px',
            border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none',
            background: '#fafafa',
          }}
        />
        <button
          type="submit"
          disabled={!message.trim() || sending}
          style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: message.trim() ? '#6366f1' : '#e5e7eb',
            border: 'none', cursor: message.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <Send size={13} color={message.trim() ? '#fff' : '#9ca3af'} />
        </button>
      </form>
    </div>
  )
}
