import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { CircuitModel } from '../../core/types';
import { COLORS, GRID_SIZE } from '../../core/constants';
import { ComponentSymbol } from './ComponentSymbol';
import { WireRenderer } from './WireRenderer';

interface CircuitRendererProps {
  model: CircuitModel;
  mode: "edit" | "simulate";
  onComponentClick?: (componentId: string) => void;
  onComponentDrag?: (componentId: string, newX: number, newY: number) => void;
  onPortClick?: (componentId: string, portId: string) => void;
  showGrid?: boolean;
  showLabels?: boolean;
  selectedComponentId?: string | null;
}

function computeBounds(model: CircuitModel) {
  if (model.components.length === 0) {
    return { minX: -5, minY: -5, maxX: 20, maxY: 15 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const comp of model.components) {
    minX = Math.min(minX, comp.x - 4);
    minY = Math.min(minY, comp.y - 4);
    maxX = Math.max(maxX, comp.x + 4);
    maxY = Math.max(maxY, comp.y + 4);
  }
  return { minX, minY, maxX, maxY };
}

export function CircuitRenderer({
  model,
  mode,
  onComponentClick,
  onComponentDrag,
  onPortClick,
  showGrid = true,
  selectedComponentId,
}: CircuitRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ id: string; startMouseX: number; startMouseY: number; startCompX: number; startCompY: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const bounds = computeBounds(model);
  const viewW = (bounds.maxX - bounds.minX) * GRID_SIZE;
  const viewH = (bounds.maxY - bounds.minY) * GRID_SIZE;
  const viewX = bounds.minX * GRID_SIZE;
  const viewY = bounds.minY * GRID_SIZE;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.2), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, componentId?: string) => {
    if (mode === "simulate") return;
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Pan
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.preventDefault();
      return;
    }
    if (e.button === 0 && componentId) {
      const comp = model.components.find((c) => c.id === componentId);
      if (!comp) return;
      setDragging({
        id: componentId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startCompX: comp.x,
        startCompY: comp.y,
      });
      onComponentClick?.(componentId);
      e.stopPropagation();
    }
  }, [mode, model, onComponentClick, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      return;
    }
    if (!dragging || mode === "simulate") return;
    const dx = e.clientX - dragging.startMouseX;
    const dy = e.clientY - dragging.startMouseY;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = (viewW * zoom) / rect.width;
    const scaleY = (viewH * zoom) / rect.height;
    const newX = Math.round(dragging.startCompX + (dx * scaleX) / GRID_SIZE);
    const newY = Math.round(dragging.startCompY + (dy * scaleY) / GRID_SIZE);
    onComponentDrag?.(dragging.id, newX, newY);
  }, [dragging, mode, viewW, viewH, zoom, onComponentDrag]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    isPanning.current = false;
  }, []);

  useEffect(() => {
    const handleUp = () => {
      setDragging(null);
      isPanning.current = false;
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, []);

  const gridLines: React.ReactNode[] = [];
  if (showGrid) {
    for (let gx = Math.floor(bounds.minX); gx <= Math.ceil(bounds.maxX); gx++) {
      gridLines.push(
        <line key={`gx${gx}`} x1={gx * GRID_SIZE} y1={viewY} x2={gx * GRID_SIZE} y2={(bounds.maxY) * GRID_SIZE}
          stroke={COLORS.grid} strokeWidth={0.5} />,
      );
    }
    for (let gy = Math.floor(bounds.minY); gy <= Math.ceil(bounds.maxY); gy++) {
      gridLines.push(
        <line key={`gy${gy}`} x1={viewX} y1={gy * GRID_SIZE} x2={(bounds.maxX) * GRID_SIZE} y2={gy * GRID_SIZE}
          stroke={COLORS.grid} strokeWidth={0.5} />,
      );
    }
  }

  return (
    <svg
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        background: COLORS.background,
        cursor: dragging ? 'grabbing' : isPanning.current ? 'grab' : 'default',
        userSelect: 'none',
      }}
      viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid meet"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onComponentClick?.('');
        }
      }}
    >
      <g transform={`scale(${zoom}) translate(${pan.x / zoom},${pan.y / zoom})`}>
        {/* Grid */}
        {gridLines}

        {/* Wires (drawn below components) */}
        {model.wires.map((wire) => (
          <WireRenderer key={wire.id} wire={wire} model={model} />
        ))}

        {/* Components */}
        {model.components.map((comp) => (
          <g
            key={comp.id}
            style={{ cursor: mode === "edit" ? 'pointer' : 'default' }}
            onMouseDown={(e) => handleMouseDown(e, comp.id)}
          >
            <ComponentSymbol
              component={comp}
              selected={selectedComponentId === comp.id}
              showPorts={mode === "edit" && selectedComponentId === comp.id}
              onPortClick={(portId) => onPortClick?.(comp.id, portId)}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
