import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { CircuitModel } from '../../core/types';
import { COLORS, GRID_SIZE } from '../../core/constants';
import { ComponentSymbol } from './ComponentSymbol';
import { WireRenderer } from './WireRenderer';

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CircuitRendererProps {
  model: CircuitModel;
  mode: "edit" | "simulate";
  onComponentClick?: (componentId: string) => void;
  onComponentDrag?: (componentId: string, newX: number, newY: number) => void;
  onPortClick?: (componentId: string, portId: string) => void;
  onCanvasClick?: (svgX: number, svgY: number) => void;
  showGrid?: boolean;
  selectedComponentId?: string | null;
  viewport?: Viewport;
  onViewportChange?: (vp: Viewport) => void;
}

function autoFitViewport(model: CircuitModel): Viewport {
  if (model.components.length === 0) {
    return { x: -200, y: -200, width: 1000, height: 800 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const comp of model.components) {
    minX = Math.min(minX, comp.x - 4);
    minY = Math.min(minY, comp.y - 4);
    maxX = Math.max(maxX, comp.x + 4);
    maxY = Math.max(maxY, comp.y + 4);
  }
  return {
    x: minX * GRID_SIZE,
    y: minY * GRID_SIZE,
    width: (maxX - minX) * GRID_SIZE,
    height: (maxY - minY) * GRID_SIZE,
  };
}

export function CircuitRenderer({
  model, mode, onComponentClick, onComponentDrag, onPortClick, onCanvasClick,
  showGrid = true, selectedComponentId, viewport, onViewportChange,
}: CircuitRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    id: string; startClientX: number; startClientY: number; startCompX: number; startCompY: number;
  } | null>(null);
  const panRef = useRef<{ startClientX: number; startClientY: number; startVp: Viewport } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const isControlled = viewport !== undefined && onViewportChange !== undefined;
  const effectiveVp: Viewport = viewport ?? autoFitViewport(model);

  // Space key tracking for pan-modifier in edit mode
  useEffect(() => {
    if (!isControlled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isControlled]);

  const clientToSvg = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const svgX = effectiveVp.x + ((clientX - rect.left) / rect.width) * effectiveVp.width;
    const svgY = effectiveVp.y + ((clientY - rect.top) / rect.height) * effectiveVp.height;
    return { x: svgX, y: svgY };
  }, [effectiveVp]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isControlled) return;
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cursorXRatio = (e.clientX - rect.left) / rect.width;
    const cursorYRatio = (e.clientY - rect.top) / rect.height;
    const cursorSvgX = effectiveVp.x + cursorXRatio * effectiveVp.width;
    const cursorSvgY = effectiveVp.y + cursorYRatio * effectiveVp.height;

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const newWidth = Math.max(300, Math.min(4800, effectiveVp.width * zoomFactor));
    const newHeight = Math.max(200, Math.min(3200, effectiveVp.height * zoomFactor));

    onViewportChange!({
      x: cursorSvgX - cursorXRatio * newWidth,
      y: cursorSvgY - cursorYRatio * newHeight,
      width: newWidth,
      height: newHeight,
    });
  }, [isControlled, effectiveVp, onViewportChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent, componentId?: string) => {
    // Middle-mouse or Space+left triggers pan (edit mode only)
    if (isControlled && (e.button === 1 || (e.button === 0 && spaceHeld))) {
      panRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startVp: effectiveVp,
      };
      setIsPanning(true);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (mode === 'simulate') return;
    if (e.button !== 0) return;
    if (componentId) {
      const comp = model.components.find((c) => c.id === componentId);
      if (!comp) return;
      setDragging({
        id: componentId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCompX: comp.x,
        startCompY: comp.y,
      });
      onComponentClick?.(componentId);
      e.stopPropagation();
    }
  }, [isControlled, spaceHeld, mode, model, onComponentClick, effectiveVp]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panRef.current) {
      const { startClientX, startClientY, startVp } = panRef.current;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = (e.clientX - startClientX) * (startVp.width / rect.width);
      const dy = (e.clientY - startClientY) * (startVp.height / rect.height);
      onViewportChange?.({
        ...startVp,
        x: startVp.x - dx,
        y: startVp.y - dy,
      });
      return;
    }
    if (!dragging || mode === 'simulate') return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = effectiveVp.width / rect.width;
    const scaleY = effectiveVp.height / rect.height;
    const dx = e.clientX - dragging.startClientX;
    const dy = e.clientY - dragging.startClientY;
    const newX = Math.round(dragging.startCompX + (dx * scaleX) / GRID_SIZE);
    const newY = Math.round(dragging.startCompY + (dy * scaleY) / GRID_SIZE);
    onComponentDrag?.(dragging.id, newX, newY);
  }, [dragging, mode, effectiveVp, onComponentDrag, onViewportChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
    }
  }, []);

  useEffect(() => {
    const up = () => {
      setDragging(null);
      if (panRef.current) {
        panRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // Grid lines — always cover the full visible viewport
  const gridLines: React.ReactNode[] = [];
  if (showGrid) {
    const gx0 = Math.floor(effectiveVp.x / GRID_SIZE);
    const gx1 = Math.ceil((effectiveVp.x + effectiveVp.width) / GRID_SIZE);
    const gy0 = Math.floor(effectiveVp.y / GRID_SIZE);
    const gy1 = Math.ceil((effectiveVp.y + effectiveVp.height) / GRID_SIZE);
    for (let gx = gx0; gx <= gx1; gx++) {
      gridLines.push(
        <line key={`gx${gx}`}
          x1={gx * GRID_SIZE} y1={gy0 * GRID_SIZE}
          x2={gx * GRID_SIZE} y2={gy1 * GRID_SIZE}
          stroke={COLORS.grid} strokeWidth={0.5} />
      );
    }
    for (let gy = gy0; gy <= gy1; gy++) {
      gridLines.push(
        <line key={`gy${gy}`}
          x1={gx0 * GRID_SIZE} y1={gy * GRID_SIZE}
          x2={gx1 * GRID_SIZE} y2={gy * GRID_SIZE}
          stroke={COLORS.grid} strokeWidth={0.5} />
      );
    }
  }

  const cursor = isPanning ? 'grabbing' : (spaceHeld ? 'grab' : (dragging ? 'grabbing' : 'default'));

  return (
    <svg
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        background: COLORS.background,
        cursor,
        userSelect: 'none',
        display: 'block',
      }}
      viewBox={`${effectiveVp.x} ${effectiveVp.y} ${effectiveVp.width} ${effectiveVp.height}`}
      preserveAspectRatio="xMidYMid meet"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          // Middle-mouse / space+drag pan on empty canvas
          if (isControlled && (e.button === 1 || (e.button === 0 && spaceHeld))) {
            panRef.current = {
              startClientX: e.clientX,
              startClientY: e.clientY,
              startVp: effectiveVp,
            };
            setIsPanning(true);
            e.preventDefault();
            return;
          }
          if (e.button === 0 && !spaceHeld) {
            // Empty-canvas click: deselect + (optional) forward svg coords for placement
            onComponentClick?.('');
            const pt = clientToSvg(e.clientX, e.clientY);
            if (pt) onCanvasClick?.(pt.x, pt.y);
          }
        }
      }}
    >
      {gridLines}

      {model.wires.map((wire) => (
        <WireRenderer key={wire.id} wire={wire} model={model} />
      ))}

      {model.components.map((comp) => (
        <g
          key={comp.id}
          style={{ cursor: mode === 'edit' && !spaceHeld ? 'pointer' : 'default' }}
          onMouseDown={(e) => handleMouseDown(e, comp.id)}
        >
          <ComponentSymbol
            component={comp}
            selected={selectedComponentId === comp.id}
            showPorts={mode === 'edit' && selectedComponentId === comp.id}
            onPortClick={(portId) => onPortClick?.(comp.id, portId)}
          />
        </g>
      ))}
    </svg>
  );
}
