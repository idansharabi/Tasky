export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Delete', danger = true }) {
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
        maxWidth: '400px',
        padding: '28px 24px 24px',
      }}>
        <p style={{
          fontSize: '15px', color: '#374151', textAlign: 'center',
          margin: '0 0 24px', lineHeight: 1.5,
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px', borderRadius: '10px',
              border: '1px solid #e5e7eb', background: '#fff',
              fontSize: '14px', fontWeight: 600, color: '#374151',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px', borderRadius: '10px',
              border: 'none',
              background: danger ? '#ef4444' : '#6366f1',
              fontSize: '14px', fontWeight: 600, color: '#fff',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
