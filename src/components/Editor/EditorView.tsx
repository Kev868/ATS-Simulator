import { useState, useCallback, useEffect, useRef } from 'react';
import type { CircuitModel, ComponentType, CircuitComponent } from '../../core/types';
import { EditorToolbar } from './EditorToolbar';
import { ComponentPalette } from './ComponentPalette';
import { EditorCanvas, type EditorCanvasHandle } from './EditorCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { ConfirmModal } from '../shared/ConfirmModal';
import { validateCircuit } from '../../core/Validator';
import { applyEnergization } from '../../core/EnergizationSolver';
import { serializeCircuit, deserializeCircuit, createEmptyCircuit, cloneCircuit } from '../../core/serialization';

const MAX_HISTORY = 50;

interface EditorViewProps {
  initialModel: CircuitModel;
  onRunSimulation: (model: CircuitModel) => void;
  onBack: () => void;
}

export function EditorView({ initialModel, onRunSimulation, onBack }: EditorViewProps) {
  const [history, setHistory] = useState<CircuitModel[]>([cloneCircuit(initialModel)]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [placingType, setPlacingType] = useState<ComponentType | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const canvasRef = useRef<EditorCanvasHandle>(null);

  const model = history[historyIdx];

  const pushHistory = useCallback((newModel: CircuitModel) => {
    const energizedModel = cloneCircuit(newModel);
    applyEnergization(energizedModel);
    setHistory((h) => {
      const trimmed = h.slice(0, historyIdx + 1);
      return [...trimmed, energizedModel].slice(-MAX_HISTORY);
    });
    setHistoryIdx((i) => Math.min(i + 1, MAX_HISTORY - 1));
  }, [historyIdx]);

  const handleModelChange = useCallback((newModel: CircuitModel) => {
    pushHistory(newModel);
  }, [pushHistory]);

  const handleUndo = useCallback(() => {
    setHistoryIdx((i) => Math.max(0, i - 1));
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryIdx((i) => Math.min(history.length - 1, i + 1));
  }, [history.length]);

  const handleDelete = useCallback(() => {
    if (selectedWireId) {
      const newModel = {
        ...model,
        wires: model.wires.filter((w) => w.id !== selectedWireId),
      };
      pushHistory(newModel);
      setSelectedWireId(null);
      return;
    }
    if (!selectedId) return;
    const newModel = {
      ...model,
      components: model.components.filter((c) => c.id !== selectedId),
      wires: model.wires.filter(
        (w) => w.fromComponentId !== selectedId && w.toComponentId !== selectedId,
      ),
    };
    pushHistory(newModel);
    setSelectedId(null);
  }, [selectedId, selectedWireId, model, pushHistory]);

  const handleRotate = useCallback(() => {
    if (!selectedId) return;
    const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
    const newModel = {
      ...model,
      components: model.components.map((c) => {
        if (c.id !== selectedId) return c;
        const idx = rotations.indexOf(c.rotation);
        const nextRot = rotations[(idx + 1) % 4];
        return { ...c, rotation: nextRot };
      }),
    };
    pushHistory(newModel);
  }, [selectedId, model, pushHistory]);

  const handleComponentUpdate = useCallback((id: string, updates: Partial<CircuitComponent>) => {
    const newModel = {
      ...model,
      components: model.components.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    };
    pushHistory(newModel);
  }, [model, pushHistory]);

  const handleSave = useCallback(() => {
    const json = serializeCircuit(model);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [model]);

  const handleLoad = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const loaded = deserializeCircuit(ev.target?.result as string);
          const report = validateCircuit(loaded);
          if (!report.valid) {
            alert(`Circuit has ${report.errors.length} error(s):\n${report.errors.map((e) => e.message).join('\n')}`);
            return;
          }
          applyEnergization(loaded);
          pushHistory(loaded);
        } catch (err) {
          alert(`Failed to load circuit: ${err}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [pushHistory]);

  const handleNew = useCallback(() => {
    setConfirmModal({
      message: "Discard unsaved work and create a new circuit?",
      onConfirm: () => {
        pushHistory(createEmptyCircuit());
        setSelectedId(null);
        setConfirmModal(null);
      },
    });
  }, [pushHistory]);

  const handleRunSimulation = useCallback(() => {
    const report = validateCircuit(model);
    if (!report.valid) {
      alert(`Cannot simulate — circuit has errors:\n${report.errors.map((e) => e.message).join('\n')}`);
      return;
    }
    onRunSimulation(model);
  }, [model, onRunSimulation]);

  // ESC cancels placement/wiring
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlacingType(null);
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((selectedId || selectedWireId) && document.activeElement?.tagName !== 'INPUT') handleDelete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedWireId, handleDelete]);

  const selectedComponent = model.components.find((c) => c.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a' }}>
      <EditorToolbar
        circuitName={model.name}
        canUndo={historyIdx > 0}
        canRedo={historyIdx < history.length - 1}
        hasSelection={selectedId !== null || selectedWireId !== null}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDelete={handleDelete}
        onRotate={handleRotate}
        onSave={handleSave}
        onLoad={handleLoad}
        onNew={handleNew}
        onRunSimulation={handleRunSimulation}
        onBack={onBack}
        onNameChange={(name) => handleModelChange({ ...model, name })}
        onFit={() => canvasRef.current?.fitToContent()}
        onResetView={() => canvasRef.current?.resetView()}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ComponentPalette
          selectedType={placingType}
          onSelect={(type) => setPlacingType((t) => t === type ? null : type)}
        />
        <EditorCanvas
          ref={canvasRef}
          model={model}
          selectedComponentId={selectedId}
          selectedWireId={selectedWireId}
          placingType={placingType}
          onModelChange={handleModelChange}
          onSelectionChange={(id) => { setSelectedId(id); if (id) setSelectedWireId(null); }}
          onWireSelectionChange={(id) => { setSelectedWireId(id); if (id) setSelectedId(null); }}
          onPlacementDone={() => setPlacingType(null)}
        />
        <PropertiesPanel
          component={selectedComponent}
          model={model}
          onUpdate={handleComponentUpdate}
        />
      </div>
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
