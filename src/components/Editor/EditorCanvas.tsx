import React, { useState, useCallback, useRef } from 'react';
import type { CircuitModel, ComponentType, CircuitWire } from '../../core/types';
import { CircuitRenderer } from '../shared/CircuitRenderer';
import { COMPONENT_REGISTRY, createComponent } from '../../core/ComponentRegistry';
import { COLORS, GRID_SIZE } from '../../core/constants';

let idCounter = 1;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}

interface EditorCanvasProps {
  model: CircuitModel;
  selectedComponentId: string | null;
  placingType: ComponentType | null;
  onModelChange: (model: CircuitModel) => void;
  onSelectionChange: (id: string | null) => void;
  onPlacementDone: () => void;
}

function computeBounds(model: CircuitModel) {
  if (model.components.length === 0) return { minX: -5, minY: -5, maxX: 20, maxY: 15 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of model.components) {
    minX = Math.min(minX, c.x - 4);
    minY = Math.min(minY, c.y - 4);
    maxX = Math.max(maxX, c.x + 4);
    maxY = Math.max(maxY, c.y + 4);
  }
  return { minX, minY, maxX, maxY };
}

export function EditorCanvas({
  model, selectedComponentId, placingType, onModelChange, onSelectionChange, onPlacementDone,
}: EditorCanvasProps) {
  const [wiringFrom, setWiringFrom] = useState<{ componentId: string; portId: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingType) return;
    const div = containerRef.current;
    if (!div) return;
    const rect = div.getBoundingClientRect();
    const bounds = computeBounds(model);
    const viewW = (bounds.maxX - bounds.minX) * GRID_SIZE;
    const viewH = (bounds.maxY - bounds.minY) * GRID_SIZE;
    const scaleX = viewW / rect.width;
    const scaleY = viewH / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX + bounds.minX * GRID_SIZE;
    const svgY = (e.clientY - rect.top) * scaleY + bounds.minY * GRID_SIZE;
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
    <div
      ref={containerRef}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: placingType ? 'crosshair' : 'default' }}
      onClick={handleCanvasClick}
    >
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
      <CircuitRenderer
        model={model}
        mode="edit"
        selectedComponentId={selectedComponentId}
        onComponentClick={handleComponentClick}
        onComponentDrag={handleComponentDrag}
        onPortClick={handlePortClick}
        showGrid={true}
      />
    </div>
  );
}
