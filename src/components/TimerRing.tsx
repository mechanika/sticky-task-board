import { useEffect, useState } from 'react';
import { formatDuration } from '../logic';

interface Countdown {
  estimateSec: number;
  /** Time already banked. */
  spentSec: number;
}

interface Props extends Countdown {
  /** When set, the timer is running from this timestamp and the ring animates. */
  startedAt?: number | null;
  /** The current sub-task: drawn as an inner ring with its own smaller timer. */
  inner?: (Countdown & { title: string }) | null;
  size?: number;
}

/** Re-render on every animation frame while `active`, returning the current time. */
function useFrameNow(active: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const tick = () => {
      setNow(Date.now());
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active]);
  return active ? now : Date.now();
}

function measure({ estimateSec, spentSec }: Countdown, elapsed: number) {
  const spent = spentSec + elapsed;
  const remaining = estimateSec - spent;
  const fraction = estimateSec > 0 ? Math.max(0, Math.min(1, remaining / estimateSec)) : 0;
  const over = remaining < 0;
  // Warn for the last 10% of the estimate or the last 5 minutes, whichever is longer.
  const warn = !over && estimateSec > 0 && remaining <= Math.max(estimateSec * 0.1, 300);
  const text = estimateSec > 0 ? formatDuration(remaining) : formatDuration(-spent);
  return { spent, fraction, over, warn, text };
}

function Arc({ mid, r, stroke, fraction, className }: { mid: number; r: number; stroke: number; fraction: number; className: string }) {
  const c = 2 * Math.PI * r;
  return (
    <>
      <circle cx={mid} cy={mid} r={r} className={`ring-track ${className}`} strokeWidth={1} fill="none" />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        className={`ring-arc ${className}`}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="butt"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        transform={`rotate(-90 ${mid} ${mid})`}
      />
    </>
  );
}

/**
 * Countdown ring drawn in flat, thin lines: the arc shrinks continuously over a
 * hairline track as the estimate is used up, and turns red in overtime. With a
 * current sub-task, an inner ring and a smaller timer count that down too;
 * otherwise a fine inner ring sweeps once a minute while running.
 */
export function TimerRing({ estimateSec, spentSec, startedAt = null, inner = null, size = 220 }: Props) {
  const running = startedAt !== null;
  const now = useFrameNow(running);
  const elapsed = running ? Math.max(0, (now - startedAt) / 1000) : 0;
  const outer = measure({ estimateSec, spentSec }, elapsed);
  const sub = inner ? measure(inner, elapsed) : null;

  const stroke = Math.max(3, size * 0.035);
  const r = (size - stroke) / 2;
  const small = size < 80;
  const mid = size / 2;
  const innerR = r - stroke * 2.5;
  const sweepC = 2 * Math.PI * innerR;
  const state = (m: { over: boolean; warn: boolean }) =>
    `${running ? 'running' : 'paused'} ${m.over ? 'over' : m.warn ? 'warn' : ''}`;

  return (
    <div className={`ring ${state(outer)}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <Arc mid={mid} r={r} stroke={stroke} fraction={outer.fraction} className={outer.over ? 'over' : ''} />
        {sub && !small && (
          <Arc mid={mid} r={innerR} stroke={stroke * 0.6} fraction={sub.fraction} className={`inner ${sub.over ? 'over' : ''}`} />
        )}
        {!sub && running && !small && (
          <circle
            cx={mid}
            cy={mid}
            r={innerR}
            className="ring-sweep"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="butt"
            strokeDasharray={sweepC}
            strokeDashoffset={sweepC * (1 - (outer.spent % 60) / 60)}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        )}
      </svg>
      <div className="ring-label" style={{ fontSize: small ? size * 0.24 : size * 0.16 }}>
        <span className={`ring-time ${state(outer)}`}>{outer.text}</span>
        {!small && !sub && (
          <span className="ring-sub">{outer.over ? 'over estimate' : estimateSec > 0 ? 'remaining' : 'no estimate'}</span>
        )}
        {!small && sub && inner && (
          <>
            <span className={`ring-time ring-subtime ${state(sub)}`}>{sub.text}</span>
            <span className="ring-sub ring-subtitle">{inner.title}</span>
          </>
        )}
      </div>
    </div>
  );
}
