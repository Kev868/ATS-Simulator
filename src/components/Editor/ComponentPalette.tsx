
import type { ComponentType } from '../../core/types';
import { COMPONENT_REGISTRY } from '../../core/ComponentRegistry';
import { COLORS } from '../../core/constants';

interface ComponentPaletteProps {
  onSelect: (type: ComponentType) => void;
  selectedType: ComponentType | null;
}

const PALETTE_TYPES: ComponentType[] = [
  "utility-source",
  "generator-source",
  "circuit-breaker",
  "bus-segment",
  "load",
  "ground",
  "junction",
];

export function ComponentPalette({ onSelect, selectedType }: ComponentPaletteProps) {
  return (
    <div style={{
      width: 180,
      background: '#0f172a',
      borderRight: `1px solid #1e293b`,
      padding: '8px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '8px 12px', fontSize: 11, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Components
      </div>
      {PALETTE_TYPES.map((type) => {
        const def = COMPONENT_REGISTRY[type];
        const isSelected = type === selectedType;
        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              background: isSelected ? '#1e3a5f' : 'transparent',
              border: 'none',
              borderLeft: isSelected ? `3px solid ${COLORS.selected}` : '3px solid transparent',
              color: isSelected ? COLORS.selected : COLORS.text,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'monospace',
            }}
          >
            <div>{def.label}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{def.description.slice(0, 30)}</div>
          </button>
        );
      })}
    </div>
  );
}
