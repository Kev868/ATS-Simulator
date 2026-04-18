import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { CircuitModel, ComponentType, CircuitWire } from '../../core/types';
import { CircuitRenderer, type Viewport } from '../shared/CircuitRenderer';
import { COMPONENT_REGISTRY, createComponent } from '../../core/ComponentRegistry';
import { COLORS, GRID_SIZE } from '../../core/constants';

let idCounter = 1;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}

const DEFAULT_VIEWPORT: Viewport = { x: -100, y: -100, width: 1200, height: 800 };

interface EditorCanvasProps {
  model: CircuitModel;
  selectedComponentId: string | null;
  placingType: ComponentType | null;
  onModelChange: (model: CircuitModel) => void;
  onSelectionChange: (id: string | null) => void;
  onPlacementDone: () => void;
}

export interface EditorCanvasHandle {
  fitToContent: () => void;
  resetView: () => void;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas({
  model, selectedComponentId, placingType, onModelChange, onSelectionChange, onPlacementDone,
}, ref) {
  const [wiringFrom, setWiringFrom] = useState<{ componentId: string; portId: string } | null>(null);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);

  useImperativeHandle(ref, () => ({
    fitToContent: () => {
      if (model.components.length === 0) {
        setViewport(DEFAULT_VIEWPORT);
        return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of model.components) {
        minX = Math.min(minX, c.x - 3);
        minY = Math.min(minY, c.y - 3);
        maxX = Math.max(maxX, c.x + 3);
        maxY = Math.max(maxY, c.y + 3);
      }
      const padding = 2;
      setViewport({
        x: (minX - padding) * GRID_SIZE,
        y: (minY - padding) * GRID_SIZE,
        width: (maxX - minX + padding * 2) * GRID_SIZE,
        height: (maxY - minY + padding * 2) * GRID_SIZE,
      });
    },
    resetView: () => setViewport(DEFAULT_VIEWPORT),
  }), [model.components]);

  const handleComponentClick = useCallback((componentId: string) => {
    if (!componentId) {
      onSelectionChange(null);
      setWiringFrom(null);
      return;
    }
    if (!placingType) {
      onSelectionChange(componentId);
    }
  }, [onSelectionChange, placingType]);

  const handlePortClick = useCallback((componentId: string, portId: string) => {
    if (!wiringFrom) {
      setWiringFrom({ componentId, portId });
      return;
    }
    if (wiringFrom.componentId === componentId && wiringFrom.portId === portId) {
      setWiringFrom(null);
      return;
    }
    const alreadyWired = model.wires.some(
      (w) =>
        (w.fromComponentId === componentId && w.fromPortId === portId) ||
        (w.toComponentId === componentId && w.toPortId === portId),
    );
    if (alreadyWired) {
      setWiringFrom(null);
      return;
    }
    const newWire: CircuitWire = {
      id: genId('w'),
      fromComponentId: wiringFrom.componentId,
      fromPortId: wiringFrom.portId,
      toComponentId: componentId,
      toPortId: portId,
    };
    onModelChange({ ...model, wires: [...model.wires, newWire] });
    setWiringFrom(null);
  }, [wiringFrom, model, onModelChange]);

  const handleComponentDrag = useCallback((componentId: string, newX: number, newY: number) => {
    onModelChange({
      ...model,
      components: model.components.map((c) =>
        c.id === componentId ? { ...c, x: newX, y: newY } : c,
      ),
    });
  }, [model, onModelChange]);

  const handleCanvasClick = useCallback((svgX: number, svgY: number) => {
    if (!placingType) return;
    const gx = Math.round(svgX / GRID_SIZE);
    const gy = Math.round(svgY / GRID_SIZE);

    const def = COMPONENT_REGISTRY[placingType];
    const tag = `${def.label.replace(/\s+/g, '-').toUpperCase()}-${idCounter}`;
    const comp = createComponent(placingType, genId('comp'), tag, gx, gy);

    if (def.isSource) {
      comp.state.voltagePercent = 100;
      comp.state.frequencyHz = comp.properties.nominalFrequency ?? 60;
    }

    onModelChange({ ...model, components: [...model.components, comp] });
    onPlacementDone();
  }, [placingType, model, onModelChange, onPlacementDone]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: placingType ? 'crosshair' : 'default' }}>
      {placingType && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: '#1e3a5f', border: `1px solid ${COLORS.selected}`, borderRadius: 4,
          padding: '4px 12px', fontSize: 12, color: COLORS.selected, zIndex: 10,
          pointerEvents: 'none',
        }}>
          Click canvas to place {COMPONENT_REGISTRY[placingType].label} · ESC to cancel
        </div>
      )}
      {wiringFrom && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: '#1c2a1e', border: '1px solid #22c55e', borderRadius: 4,
          padding: '4px 12px', fontSize: 12, color: '#22c55e', zIndex: 10,
          pointerEvents: 'none',
        }}>
          Wiring from port '{wiringFrom.portId}' — click another port to connect · ESC to cancel
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 8, right: 8, zIndex: 10,
        fontSize: 11, color: COLORS.textDim, fontFamily: 'monospace',
        pointerEvents: 'none',
        background: 'rgba(15,23,42,0.7)', padding: '2px 6px', borderRadius: 3,
      }}>
        Scroll: zoom · Space+drag or middle-drag: pan
      </div>
      <CircuitRenderer
        model={model}
        mode="edit"
        selectedComponentId={selectedComponentId}
        onComponentClick={handleComponentClick}
        onComponentDrag={handleComponentDrag}
        onPortClick={handlePortClick}
        onCanvasClick={handleCanvasClick}
        showGrid={true}
        viewport={viewport}
        onViewportChange={setViewport}
      />
    </div>
  );
});
