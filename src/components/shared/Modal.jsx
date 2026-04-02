import { useEffect } from 'react'
import { X } from 'lucide-react'

const SIZE_WIDTH = { sm: '420px', md: '560px', lg: '720px' }

export default function Modal({ title, children, onClose, size = 'md' }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '18px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        width: '100%',
        maxWidth: SIZE_WIDTH[size] || SIZE_WIDTH.md,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #f3f4f6',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.3px' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '7px', borderRadius: '8px', border: 'none',
              background: '#f3f4f6', cursor: 'pointer', color: '#6b7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
