import { Breaker, BreakerState } from './types';

export function openBreaker(breaker: Breaker, _simTime: number): Breaker {
  if (breaker.state === 'OPEN') return breaker;
  if (breaker.lockedOut) return breaker;
  return {
    ...breaker,
    state: 'TRIPPING',
    elapsed: 0,
  };
}

export function closeBreaker(breaker: Breaker, _simTime: number): Breaker {
  if (breaker.state === 'CLOSED') return breaker;
  if (breaker.lockedOut) return breaker;
  return {
    ...breaker,
    state: 'CLOSING',
    elapsed: 0,
  };
}

export function tripBreaker(breaker: Breaker, simTime: number): Breaker {
  return openBreaker(breaker, simTime);
}

export function tickBreaker(breaker: Breaker, dt: number): Breaker {
  if (breaker.state !== 'CLOSING' && breaker.state !== 'TRIPPING') {
    return breaker;
  }

  const newElapsed = breaker.elapsed + dt;

  if (newElapsed >= breaker.operationTimeMs) {
    let newState: BreakerState;
    if (breaker.state === 'CLOSING') {
      newState = 'CLOSED';
    } else {
      newState = 'OPEN';
    }
    return {
      ...breaker,
      state: newState,
      elapsed: 0,
    };
  }

  return {
    ...breaker,
    elapsed: newElapsed,
  };
}

export function isClosed(breaker: Breaker): boolean {
  return breaker.state === 'CLOSED';
}

export function isOpen(breaker: Breaker): boolean {
  return breaker.state === 'OPEN';
}

export function isOperating(breaker: Breaker): boolean {
  return breaker.state === 'CLOSING' || breaker.state === 'TRIPPING';
}
