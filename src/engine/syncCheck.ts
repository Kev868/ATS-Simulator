import { Source, Setpoints } from './types';

export interface SyncCheckResult {
  pass: boolean;
  dV: number;
  df: number;
  dPhi: number;
  reason: string;
}

export function checkSync(
  sourceA: Source,
  sourceB: Source,
  setpoints: Setpoints
): SyncCheckResult {
  const dV = Math.abs(sourceA.voltage - sourceB.voltage);
  const df = Math.abs(sourceA.frequency - sourceB.frequency);

  // Phase difference, accounting for wrap-around
  let rawDPhi = Math.abs(sourceA.phaseAngle - sourceB.phaseAngle);
  if (rawDPhi > 180) rawDPhi = 360 - rawDPhi;
  const dPhi = rawDPhi;

  const reasons: string[] = [];

  if (dV > setpoints.syncCheckDV) {
    reasons.push(`ΔV=${dV.toFixed(1)}% exceeds limit ${setpoints.syncCheckDV}%`);
  }
  if (df > setpoints.syncCheckDf) {
    reasons.push(`Δf=${df.toFixed(3)}Hz exceeds limit ${setpoints.syncCheckDf}Hz`);
  }
  if (dPhi > setpoints.syncCheckDPhi) {
    reasons.push(`Δφ=${dPhi.toFixed(1)}° exceeds limit ${setpoints.syncCheckDPhi}°`);
  }

  const pass = reasons.length === 0;

  return {
    pass,
    dV,
    df,
    dPhi,
    reason: pass ? 'Sync check passed' : `Sync check failed: ${reasons.join('; ')}`,
  };
}
