import { Source, Setpoints, SourceHealth } from './types';

export interface SourceEvaluation {
  health: SourceHealth;
  faults: string[];
  voltPct: number;
}

export function hasUndervoltage(source: Source, setpoints: Setpoints): boolean {
  if (!source.available) return false;
  const voltPct = source.voltage;
  return voltPct < setpoints.uvThreshold && voltPct > setpoints.deadSourceThreshold;
}

export function hasOvervoltage(source: Source, setpoints: Setpoints): boolean {
  if (!source.available) return false;
  return source.voltage > setpoints.ovThreshold;
}

export function hasUnderfrequency(source: Source, setpoints: Setpoints): boolean {
  if (!source.available) return false;
  if (source.voltage <= setpoints.deadSourceThreshold) return false;
  return source.frequency < setpoints.ufThreshold;
}

export function hasOverfrequency(source: Source, setpoints: Setpoints): boolean {
  if (!source.available) return false;
  if (source.voltage <= setpoints.deadSourceThreshold) return false;
  return source.frequency > setpoints.ofThreshold;
}

export function isDead(source: Source, setpoints: Setpoints): boolean {
  if (!source.available) return true;
  return source.voltage <= setpoints.deadSourceThreshold;
}

export function evaluateSource(source: Source, setpoints: Setpoints): SourceEvaluation {
  const voltPct = source.voltage;
  const faults: string[] = [];

  if (!source.available) {
    return {
      health: 'FAILED',
      faults: ['UNAVAILABLE'],
      voltPct,
    };
  }

  if (isDead(source, setpoints)) {
    return {
      health: 'FAILED',
      faults: ['DEAD'],
      voltPct,
    };
  }

  if (hasUndervoltage(source, setpoints)) faults.push('UV');
  if (hasOvervoltage(source, setpoints)) faults.push('OV');
  if (hasUnderfrequency(source, setpoints)) faults.push('UF');
  if (hasOverfrequency(source, setpoints)) faults.push('OF');

  let health: SourceHealth;
  if (faults.length === 0) {
    health = 'HEALTHY';
  } else {
    health = 'DEGRADED';
  }

  return { health, faults, voltPct };
}
