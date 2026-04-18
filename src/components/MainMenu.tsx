import { useState } from 'react';
import type { CircuitModel } from '../core/types';
import { deserializeCircuit } from '../core/serialization';
import { applyEnergization } from '../core/EnergizationSolver';
import { COLORS } from '../core/constants';

import twoSourceATS from '../presets/two-source-ats.json';
import mainTieMain from '../presets/main-tie-main.json';
import mainMainMain from '../presets/main-main-main.json';

interface MainMenuProps {
  onLoadCircuit: (model: CircuitModel, startInSimulator: boolean) => void;
  onBuildNew: () => void;
}

interface PresetEntry {
  id: string;
  name: string;
  description: string;
  data: object;
}

const PRESETS: PresetEntry[] = [
  {
    id: "two-source-ats",
    name: "Two-Source ATS",
    description: "Classic automatic transfer switch: one utility source, one alternate, single bus, with auto-retransfer.",
    data: twoSourceATS,
  },
  {
    id: "main-tie-main",
    name: "Main–Tie–Main",
    description: "Two independent sources, two bus sections, one tie breaker. Loss of either source isolates its bus while the tie feeds both.",
    data: mainTieMain,
  },
  {
    id: "main-main-main",
    name: "Main–Main–Main",
    description: "Three sources, three bus sections, two tie breakers. Ring topology for maximum redundancy.",
    data: mainMainMain,
  },
];

export function MainMenu({ onLoadCircuit, onBuildNew }: MainMenuProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const loadPreset = (preset: PresetEntry, startInSimulator: boolean) => {
    const model = deserializeCircuit(JSON.stringify(preset.data));
    applyEnergization(model);
    onLoadCircuit(model, startInSimulator);
  };

  const handleLoadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const model = deserializeCircuit(ev.target?.result as string);
          applyEnergization(model);
          onLoadCircuit(model, false);
        } catch (err) {
          alert(`Failed to load: ${err}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const hoveredPreset = hovered ? PRESETS.find((p) => p.id === hovered) : null;

  return (
    <div style={{
      height: '100vh',
      background: COLORS.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated grid background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}>
        <defs>
          <pattern id="grid" width={40} height={40} patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#22c55e" strokeWidth={0.5} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div style={{ display: 'flex', gap: 60, alignItems: 'flex-start', zIndex: 1 }}>
        {/* Title + menu */}
        <div style={{ width: 320 }}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>
              ANSI/IEEE
            </div>
            <h1 style={{ margin: 0, fontSize: 36, color: COLORS.text, fontWeight: 700, lineHeight: 1.1 }}>
              ATS<br />Simulator
            </h1>
            <div style={{ marginTop: 8, fontSize: 13, color: COLORS.textDim, lineHeight: 1.5 }}>
              Automatic Transfer Switch<br />Circuit Design & Simulation
            </div>
          </div>

          <div style={{ marginBottom: 16, fontSize: 11, color: COLORS.textDim, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Saved Circuits
          </div>

          {PRESETS.map((preset) => (
            <div key={preset.id} style={{ marginBottom: 4 }}>
              <div
                onMouseEnter={() => setHovered(preset.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: hovered === preset.id ? '#1e293b' : 'transparent',
                  border: `1px solid ${hovered === preset.id ? '#334155' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
              >
                <button
                  onClick={() => loadPreset(preset, true)}
                  style={{
                    background: 'none', border: 'none',
                    color: hovered === preset.id ? COLORS.text : COLORS.textDim,
                    cursor: 'pointer', fontSize: 15, fontFamily: 'monospace', textAlign: 'left',
                    flex: 1,
                  }}
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => loadPreset(preset, false)}
                  title="Open in Editor"
                  style={{
                    background: 'none', border: 'none', color: COLORS.textDim,
                    cursor: 'pointer', fontSize: 12, fontFamily: 'monospace', opacity: hovered === preset.id ? 1 : 0,
                    transition: 'opacity 0.15s',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onBuildNew}
              style={{
                padding: '12px 20px',
                background: '#16a34a',
                border: 'none', borderRadius: 6,
                color: 'white', cursor: 'pointer', fontSize: 14, fontFamily: 'monospace',
                textAlign: 'left',
              }}
            >
              + Build Custom Circuit
            </button>
            <button
              onClick={handleLoadFile}
              style={{
                padding: '10px 20px',
                background: '#1e293b',
                border: '1px solid #334155', borderRadius: 6,
                color: COLORS.text, cursor: 'pointer', fontSize: 14, fontFamily: 'monospace',
                textAlign: 'left',
              }}
            >
              Load from File
            </button>
          </div>
        </div>

        {/* Preview panel */}
        <div style={{ width: 320, minHeight: 200 }}>
          {hoveredPreset ? (
            <div style={{
              background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 8, padding: 20,
            }}>
              <div style={{ fontSize: 16, color: COLORS.text, marginBottom: 8 }}>{hoveredPreset.name}</div>
              <div style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.6 }}>{hoveredPreset.description}</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: COLORS.textDim, lineHeight: 1.8 }}>
              <div style={{ marginBottom: 16, fontSize: 12, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Features</div>
              <div>✓ Graph-based energization solver</div>
              <div>✓ ATS transfer FSM (open/closed/fast)</div>
              <div>✓ Sync check with fallback</div>
              <div>✓ Configurable timers &amp; setpoints</div>
              <div>✓ Custom circuit builder</div>
              <div>✓ Export / import JSON</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
