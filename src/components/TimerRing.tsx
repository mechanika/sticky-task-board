import { useEffect, useState } from 'react';
import { formatDuration } from '../logic';

interface Props {
  estimateSec: number;
  /** Time already banked against the task. */
  spentSec: number;
  /** When set, the timer is running from this timestamp and the ring animates. */
  startedAt?: number | null;
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

/**
 * Countdown ring drawn in flat, thin lines: the arc shrinks continuously over a
 * hairline track as the estimate is used up, and turns red in overtime. While
 * running, a fine inner ring sweeps once a minute.
 */
export function TimerRing({ estimateSec, spentSec, startedAt = null, size = 220 }: Props) {
  const running = startedAt !== null;
  const now = useFrameNow(running);
  const elapsed = running ? Math.max(0, (now - startedAt) / 1000) : 0;
  const spent = spentSec + elapsed;

  const stroke = Math.max(3, size * 0.035);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const remaining = estimateSec - spent;
  const fraction = estimateSec > 0 ? Math.max(0, Math.min(1, remaining / estimateSec)) : 0;
  const over = remaining < 0;
  const small = size < 80;
  const mid = size / 2;

  const innerStroke = 1.5;
  const innerR = r - stroke * 2.5;
  const innerC = 2 * Math.PI * innerR;
  const sweep = (spent % 60) / 60;

  return (
    <div className={`ring ${running ? 'running' : ''} ${over ? 'over' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={mid} cy={mid} r={r} className="ring-track" strokeWidth={1} fill="none" />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          className="ring-arc"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          transform={`rotate(-90 ${mid} ${mid})`}
        />
        {running && !small && (
          <circle
            cx={mid}
            cy={mid}
            r={innerR}
            className="ring-sweep"
            strokeWidth={innerStroke}
            fill="none"
            strokeLinecap="butt"
            strokeDasharray={innerC}
            strokeDashoffset={innerC * (1 - sweep)}
            transform={`rotate(-90 ${mid} ${mid})`}
          />
        )}
      </svg>
      <div className="ring-label" style={{ fontSize: small ? size * 0.24 : size * 0.16 }}>
        {estimateSec > 0 ? formatDuration(remaining) : formatDuration(-spent)}
        {!small && <span className="ring-sub">{over ? 'over estimate' : estimateSec > 0 ? 'remaining' : 'no estimate'}</span>}
      </div>
    </div>
  );
}
