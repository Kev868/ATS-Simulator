interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        className="modal-content"
        style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
          padding: '24px 32px', maxWidth: 400, color: '#e2e8f0',
        }}
      >
        <p style={{ margin: '0 0 20px', fontSize: 16 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-primary-red"
            style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer' }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
