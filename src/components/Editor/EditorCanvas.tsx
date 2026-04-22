import { useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import type { CircuitModel, ComponentType, CircuitWire } from '../../core/types';
import { CircuitRenderer, type Viewport, type WiringState } from '../shared/CircuitRenderer';
import type { PortVisualState } from '../shared/ComponentSymbol';
import { COMPONENT_REGISTRY, createComponent } from '../../core/ComponentRegistry';
import { COLORS, GRID_SIZE } from '../../core/constants';
import { resolveAllPorts } from '../../core/PortResolver';

let idCounter = 1;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}

const DEFAULT_VIEWPORT: Viewport = { x: -100, y: -100, width: 1200, height: 800 };

interface EditorCanvasProps {
  model: CircuitModel;
  selectedComponentId: string | null;
  selectedWireId: string | null;
  placingType: ComponentType | null;
  onModelChange: (model: CircuitModel) => void;
  onSelectionChange: (id: string | null) => void;
  onWireSelectionChange: (id: string | null) => void;
  onPlacementDone: () => void;
}

export interface EditorCanvasHandle {
  fitToContent: () => void;
  resetView: () => void;
}

function isPortWired(model: CircuitModel, componentId: string, portId: string): boolean {
  return model.wires.some(
    (w) =>
      (w.fromComponentId === componentId && w.fromPortId === portId) ||
      (w.toComponentId === componentId && w.toPortId === portId),
  );
}

function isValidWireTarget(
  model: CircuitModel,
  fromComponentId: string,
  fromPortId: string,
  toComponentId: string,
  toPortId: string,
): boolean {
  if (fromComponentId === toComponentId) return false;
  if (isPortWired(model, toComponentId, toPortId)) return false;
  const toComp = model.components.find((c) => c.id === toComponentId);
  if (!toComp) return false;
  const toPort = toComp.ports.find((p) => p.id === toPortId);
  if (!toPort || !toPort.enabled) return false;
  // `from` self-check already covered by same-component; explicit same-port check is subsumed too
  if (fromComponentId === toComponentId && fromPortId === toPortId) return false;
  return true;
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas({
  model, selectedComponentId, selectedWireId, placingType,
  onModelChange, onSelectionChange, onWireSelectionChange, onPlacementDone,
}, ref) {
  const [wiringFrom, setWiringFrom] = useState<{ componentId: string; portId: string } | null>(null);
  const [cursorSvg, setCursorSvg] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredPort, setHoveredPort] = useState<{ componentId: string; portId: string } | null>(null);
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

  const cancelWiring = useCallback(() => {
    setWiringFrom(null);
    setHoveredPort(null);
  }, []);

  // Escape key cancels wiring (EditorView already handles Escape for placement)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelWiring();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelWiring]);

  const handleComponentClick = useCallback((componentId: string) => {
    if (!componentId) {
      // Empty-canvas click: cancel wiring, deselect all
      onSelectionChange(null);
      onWireSelectionChange(null);
      cancelWiring();
      return;
    }
    if (wiringFrom) {
      // In wiring mode, clicking a component body cancels wiring
      cancelWiring();
      return;
    }
    if (!placingType) {
      onSelectionChange(componentId);
      onWireSelectionChange(null);
    }
  }, [onSelectionChange, onWireSelectionChange, placingType, wiringFrom, cancelWiring]);

  const handlePortClick = useCallback((componentId: string, portId: string) => {
    // Block port interaction while placing a component
    if (placingType) return;

    if (!wiringFrom) {
      // Starting a new wire — fail if port already wired or disabled
      if (isPortWired(model, componentId, portId)) return;
      const comp = model.components.find((c) => c.id === componentId);
      const port = comp?.ports.find((p) => p.id === portId);
      if (!port || !port.enabled) return;
      setWiringFrom({ componentId, portId });
      onSelectionChange(null);
      onWireSelectionChange(null);
      return;
    }
    // Completing a wire
    if (!isValidWireTarget(model, wiringFrom.componentId, wiringFrom.portId, componentId, portId)) {
      // Invalid target — leave wiring mode active, do nothing (user can still click another port or ESC)
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
    cancelWiring();
  }, [wiringFrom, model, placingType, onModelChange, onSelectionChange, onWireSelectionChange, cancelWiring]);

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

  const handleWireClick = useCallback((wireId: string) => {
    if (wiringFrom) {
      cancelWiring();
      return;
    }
    onWireSelectionChange(wireId);
    onSelectionChange(null);
  }, [wiringFrom, cancelWiring, onWireSelectionChange, onSelectionChange]);

  const handleCanvasMouseMove = useCallback((svgX: number, svgY: number) => {
    setCursorSvg({ x: svgX, y: svgY });
  }, []);

  const getPortState = useCallback((componentId: string, portId: string): PortVisualState => {
    if (wiringFrom?.componentId === componentId && wiringFrom?.portId === portId) return 'source';
    const isHovered = hoveredPort?.componentId === componentId && hoveredPort?.portId === portId;
    if (wiringFrom) {
      if (!isHovered) return 'idle';
      return isValidWireTarget(model, wiringFrom.componentId, wiringFrom.portId, componentId, portId)
        ? 'valid-target'
        : 'invalid-target';
    }
    return isHovered ? 'hover' : 'idle';
  }, [wiringFrom, hoveredPort, model]);

  // Snap rubber-band endpoint to a valid hovered target port's exact center
  let wiringState: WiringState | null = null;
  if (wiringFrom) {
    let endX = cursorSvg.x;
    let endY = cursorSvg.y;
    if (
      hoveredPort &&
      isValidWireTarget(model, wiringFrom.componentId, wiringFrom.portId, hoveredPort.componentId, hoveredPort.portId)
    ) {
      const comp = model.components.find((c) => c.id === hoveredPort.componentId);
      if (comp) {
        const rp = resolveAllPorts(comp).get(hoveredPort.portId);
        if (rp) {
          endX = rp.absoluteX * GRID_SIZE;
          endY = rp.absoluteY * GRID_SIZE;
        }
      }
    }
    wiringState = {
      fromComponentId: wiringFrom.componentId,
      fromPortId: wiringFrom.portId,
      cursorSvgX: endX,
      cursorSvgY: endY,
    };
  }

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
          Wiring — click a target port to connect · ESC or right-click to cancel
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 8, right: 8, zIndex: 10,
        fontSize: 11, color: COLORS.textDim, fontFamily: 'monospace',
        pointerEvents: 'none',
        background: 'rgba(15,23,42,0.7)', padding: '2px 6px', borderRadius: 3,
      }}>
        Scroll: zoom · Space+drag or middle-drag: pan · Click port to wire
      </div>
      <CircuitRenderer
        model={model}
        mode="edit"
        selectedComponentId={selectedComponentId}
        selectedWireId={selectedWireId}
        wiringState={wiringState}
        getPortState={getPortState}
        onComponentClick={handleComponentClick}
        onComponentDrag={handleComponentDrag}
        onPortClick={handlePortClick}
        onPortMouseEnter={(cid, pid) => setHoveredPort({ componentId: cid, portId: pid })}
        onPortMouseLeave={() => setHoveredPort(null)}
        onCanvasClick={handleCanvasClick}
        onCanvasMouseMove={handleCanvasMouseMove}
        onContextMenu={cancelWiring}
        onWireClick={handleWireClick}
        showGrid={true}
        viewport={viewport}
        onViewportChange={setViewport}
      />
    </div>
  );
});
