import { formatDuration } from '../logic';

interface Props {
  estimateSec: number;
  spentSec: number;
  size?: number;
  running?: boolean;
}

/** Countdown ring: the coloured arc shrinks as estimated time is used up, and turns red in overtime. */
export function TimerRing({ estimateSec, spentSec, size = 220, running = false }: Props) {
  const stroke = Math.max(4, size * 0.07);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const remaining = estimateSec - spentSec;
  const fraction = estimateSec > 0 ? Math.max(0, Math.min(1, remaining / estimateSec)) : 0;
  const over = remaining < 0;
  const small = size < 80;

  return (
    <div className={`ring ${running ? 'running' : ''} ${over ? 'over' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-arc"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * fraction} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label" style={{ fontSize: small ? size * 0.24 : size * 0.16 }}>
        {estimateSec > 0 ? formatDuration(remaining) : formatDuration(-spentSec)}
        {!small && <span className="ring-sub">{over ? 'over estimate' : estimateSec > 0 ? 'remaining' : 'no estimate'}</span>}
      </div>
    </div>
  );
}
