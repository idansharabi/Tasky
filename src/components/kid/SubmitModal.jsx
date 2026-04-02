import { useState, useRef } from 'react'
import { Camera, Upload, CheckCircle, Loader, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { analyzeTaskPhoto } from '../../lib/gemini'
import { useAuth } from '../../contexts/AuthContext'
import { sendPush } from '../../lib/notifications'

export default function SubmitModal({ task, onClose, onDone }) {
  const { profile } = useAuth()
  const [phase, setPhase] = useState('choose')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef()
  const cameraInputRef = useRef()

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setPhase('preview')
  }

  async function handleSubmitWithPhoto() {
    setSubmitting(true)
    setPhase('analyzing')

    try {
      let photoUrl = null
      let aiVerdict = null

      const ext = imageFile.name.split('.').pop()
      const path = `${profile.id}/${task.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('task-photos')
        .upload(path, imageFile, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        toast.error('Failed to upload photo')
        setPhase('preview')
        setSubmitting(false)
        return
      }

      const { data: urlData } = supabase.storage.from('task-photos').getPublicUrl(path)
      photoUrl = urlData.publicUrl

      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (geminiKey && geminiKey !== 'your_google_gemini_api_key') {
        const reader = new FileReader()
        const base64 = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result.split(',')[1])
          reader.readAsDataURL(imageFile)
        })
        aiVerdict = await analyzeTaskPhoto(base64, imageFile.type, task.title, task.description)
        setAiResult(aiVerdict)
      }

      await finalizeSubmission(photoUrl, aiVerdict)
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong')
      setPhase('preview')
    }
    setSubmitting(false)
  }

  async function handleSubmitWithoutPhoto() {
    setSubmitting(true)
    await finalizeSubmission(null, null)
    setSubmitting(false)
  }

  async function finalizeSubmission(photoUrl, aiVerdict) {
    const { error: subError } = await supabase
      .from('task_submissions')
      .insert({
        assignment_id: task.id,
        photo_url: photoUrl,
        ai_approved: aiVerdict?.approved ?? null,
        ai_confidence: aiVerdict?.confidence ?? null,
        ai_reasoning: aiVerdict?.reasoning ?? null,
      })
      .select()
      .single()

    if (subError) {
      toast.error('Failed to submit task')
      return
    }

    if (aiVerdict?.approved === true && aiVerdict?.confidence === 'high') {
      await supabase.from('task_assignments').update({ status: 'approved' }).eq('id', task.id)
      await supabase.from('credit_ledger').insert({
        kid_id: profile.id,
        amount: task.credit_value,
        description: `Task completed: ${task.title}`,
        assignment_id: task.id,
        created_by: profile.id,
      })
      toast.success(`🎉 AI approved! +${task.credit_value} credits!`)
    } else {
      await supabase.from('task_assignments').update({ status: 'submitted' }).eq('id', task.id)
      if (aiVerdict?.approved === false) {
        toast('Submitted for parent review — AI had a question about the photo', { icon: '🤔' })
      } else {
        toast.success('Submitted! Waiting for parent to review.')
      }
    }
    // Notify parents
    const { data: parents } = await supabase.from('profiles').select('id').eq('role', 'parent')
    if (parents?.length) {
      const parentIds = parents.map(p => p.id)
      const notifTitle = aiVerdict?.approved === true && aiVerdict?.confidence === 'high'
        ? `${profile.name} completed "${task.title}" ✅`
        : `${profile.name} submitted "${task.title}" 📋`
      const notifBody = aiVerdict?.approved === true && aiVerdict?.confidence === 'high'
        ? `Auto-approved! +${task.credit_value} credits awarded.`
        : 'Waiting for your review.'
      sendPush(parentIds, notifTitle, notifBody)
    }

    setPhase('done')
    onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'flex-end',
      justifyContent: 'center', padding: '16px',
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px',
        width: '100%', maxWidth: '400px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #f3f4f6',
        }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '15px', color: '#111827', margin: 0 }}>{task.icon} {task.title}</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>+{task.credit_value} credits on approval</p>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '7px', borderRadius: '8px', border: 'none', background: '#f3f4f6', cursor: 'pointer', color: '#6b7280', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {phase === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', margin: '0 0 8px' }}>How do you want to submit?</p>

              <button
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  width: '100%', padding: '20px',
                  borderRadius: '14px', border: '2px dashed #c7d2fe',
                  background: '#f5f3ff', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                }}
              >
                <Camera size={28} style={{ color: '#6366f1' }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Take a photo</span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>AI will check your work</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%', padding: '12px',
                  borderRadius: '12px', border: '1px solid #e5e7eb',
                  background: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  fontSize: '14px', color: '#374151', fontWeight: 500,
                }}
              >
                <Upload size={16} /> Upload from library
              </button>

              <button
                onClick={handleSubmitWithoutPhoto}
                disabled={submitting}
                style={{
                  width: '100%', padding: '12px', borderRadius: '12px',
                  border: 'none', background: '#f3f4f6',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px', color: '#6b7280', fontWeight: 500,
                }}
              >
                {submitting ? 'Submitting…' : 'Submit without photo'}
              </button>

              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          )}

          {phase === 'preview' && imagePreview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px', objectFit: 'cover', maxHeight: '220px' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); setPhase('choose') }}
                  style={{
                    flex: 1, padding: '11px', borderRadius: '10px',
                    border: '1px solid #e5e7eb', background: '#fff',
                    color: '#374151', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Retake
                </button>
                <button
                  onClick={handleSubmitWithPhoto}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: '11px', borderRadius: '10px',
                    border: 'none', background: '#6366f1',
                    color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {phase === 'analyzing' && (
            <div style={{ padding: '24px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px', objectFit: 'cover', maxHeight: '160px', opacity: 0.6 }} />}
              <Loader size={32} style={{ color: '#6366f1', animation: 'spin 0.7s linear infinite' }} />
              <div>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#111827', margin: 0 }}>Analyzing your photo…</p>
                <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>AI is checking your work 🤖</p>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div style={{ padding: '24px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle size={32} style={{ color: '#22c55e' }} />
              </div>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>Submitted!</p>
              {aiResult?.approved === true && aiResult?.confidence === 'high' ? (
                <p style={{ fontSize: '14px', color: '#16a34a', fontWeight: 600, margin: 0 }}>🎉 Auto-approved! +{task.credit_value} credits!</p>
              ) : (
                <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Waiting for a parent to review</p>
              )}
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: 'none', background: '#6366f1', color: '#fff',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px',
                }}
              >
                Back to tasks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
