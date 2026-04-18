
import { COLORS } from '../../core/constants';

interface EditorToolbarProps {
  circuitName: string;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onRotate: () => void;
  onSave: () => void;
  onLoad: () => void;
  onNew: () => void;
  onRunSimulation: () => void;
  onBack: () => void;
  onNameChange: (name: string) => void;
}

function Btn({ label, onClick, disabled, color }: { label: string; onClick: () => void; disabled?: boolean; color?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        background: color ?? '#1e293b',
        border: '1px solid #334155',
        borderRadius: 4,
        color: disabled ? COLORS.textDim : COLORS.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontFamily: 'monospace',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

export function EditorToolbar({
  circuitName, canUndo, canRedo, hasSelection,
  onUndo, onRedo, onDelete, onRotate, onSave, onLoad, onNew, onRunSimulation, onBack, onNameChange,
}: EditorToolbarProps) {
  return (
    <div style={{
      height: 48,
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 12px',
      flexShrink: 0,
    }}>
      <Btn label="← Back" onClick={onBack} />
      <div style={{ width: 1, height: 24, background: '#1e293b' }} />
      <input
        value={circuitName}
        onChange={(e) => onNameChange(e.target.value)}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          color: COLORS.text,
          fontSize: 14,
          fontFamily: 'monospace',
          padding: '4px 8px',
          borderRadius: 4,
          width: 200,
        }}
        onFocus={(e) => (e.target.style.borderColor = '#334155')}
        onBlur={(e) => (e.target.style.borderColor = 'transparent')}
      />
      <div style={{ width: 1, height: 24, background: '#1e293b' }} />
      <Btn label="New" onClick={onNew} />
      <Btn label="Save" onClick={onSave} />
      <Btn label="Load" onClick={onLoad} />
      <div style={{ width: 1, height: 24, background: '#1e293b' }} />
      <Btn label="Undo" onClick={onUndo} disabled={!canUndo} />
      <Btn label="Redo" onClick={onRedo} disabled={!canRedo} />
      <div style={{ width: 1, height: 24, background: '#1e293b' }} />
      <Btn label="Rotate" onClick={onRotate} disabled={!hasSelection} />
      <Btn label="Delete" onClick={onDelete} disabled={!hasSelection} />
      <div style={{ flex: 1 }} />
      <Btn label="▶ Run Simulation" onClick={onRunSimulation} color="#16a34a" />
    </div>
  );
}
