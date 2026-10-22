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
 * Countdown ring. The outer arc shrinks continuously as the estimate is used up
 * and turns red in overtime. While running, a thin inner ring sweeps once a
 * minute so the timer visibly moves even on long tasks.
 */
export function TimerRing({ estimateSec, spentSec, startedAt = null, size = 220 }: Props) {
  const running = startedAt !== null;
  const now = useFrameNow(running);
  const elapsed = running ? Math.max(0, (now - startedAt) / 1000) : 0;
  const spent = spentSec + elapsed;

  const stroke = Math.max(4, size * 0.07);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const remaining = estimateSec - spent;
  const fraction = estimateSec > 0 ? Math.max(0, Math.min(1, remaining / estimateSec)) : 0;
  const over = remaining < 0;
  const small = size < 80;
  const mid = size / 2;

  const innerStroke = Math.max(2, stroke * 0.3);
  const innerR = r - stroke / 2 - innerStroke * 1.5;
  const innerC = 2 * Math.PI * innerR;
  const sweep = (spent % 60) / 60;

  // Tip of the outer arc, which travels anticlockwise back towards 12 o'clock.
  const angle = -Math.PI / 2 + fraction * 2 * Math.PI;
  const tipX = mid + r * Math.cos(angle);
  const tipY = mid + r * Math.sin(angle);

  return (
    <div className={`ring ${running ? 'running' : ''} ${over ? 'over' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={mid} cy={mid} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          className="ring-arc"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          transform={`rotate(-90 ${mid} ${mid})`}
        />
        {running && fraction > 0 && <circle cx={tipX} cy={tipY} r={stroke * 0.32} className="ring-tip" />}
        {running && !small && (
          <circle
            cx={mid}
            cy={mid}
            r={innerR}
            className="ring-sweep"
            strokeWidth={innerStroke}
            fill="none"
            strokeLinecap="round"
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
