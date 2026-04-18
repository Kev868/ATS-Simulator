
import type { CircuitModel } from '../../core/types';
import { CircuitRenderer } from '../shared/CircuitRenderer';

interface SimulatorCanvasProps {
  model: CircuitModel;
}

export function SimulatorCanvas({ model }: SimulatorCanvasProps) {
  return (
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <CircuitRenderer
        model={model}
        mode="simulate"
        showGrid={false}
      />
    </div>
  );
}
