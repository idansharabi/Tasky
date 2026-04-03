import Modal from './Modal'
import { releases } from '../../data/releases'

export default function ReleaseNotes({ onClose }) {
  return (
    <Modal title="Release Notes" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
        {releases.map((release, i) => (
          <div key={release.version}>
            {/* Version header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{
                fontSize: '12px', fontWeight: 700, color: '#fff',
                background: i === 0 ? '#6366f1' : '#9ca3af',
                borderRadius: '99px', padding: '3px 10px',
              }}>
                v{release.version}
              </span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{release.date}</span>
              {i === 0 && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: '#16a34a',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: '99px', padding: '2px 8px',
                }}>
                  Latest
                </span>
              )}
            </div>
            {/* Notes list */}
            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {release.notes.map((note, j) => (
                <li key={j} style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
                  {note}
                </li>
              ))}
            </ul>
            {/* Divider */}
            {i < releases.length - 1 && (
              <div style={{ height: '1px', background: '#f3f4f6', marginTop: '20px' }} />
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
