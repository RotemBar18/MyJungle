import { useId } from 'react';
import { useI18n } from '../i18n/index.jsx';

/**
 * Small line chart, drawn by hand so it can mirror properly: in RTL the time
 * axis runs right → left, matching how the rest of the interface reads.
 */
export function LineChart({ points, label }) {
  const { dir, fmtDateShort, fmtNumber } = useI18n();
  const clip = useId();
  if (!points || points.length < 2) return null;

  // Fixed drawing space, scaled uniformly by CSS. No preserveAspectRatio
  // override: stretching the viewBox would distort the labels too.
  const W = 320;
  const H = 180;
  const PAD = { start: 34, end: 12, top: 16, bottom: 30 };

  const xs = points.map((p) => +p.date);
  const ys = points.map((p) => p.value);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const spanX = x1 - x0 || 1;
  const spanY = y1 - y0 || Math.max(1, Math.abs(y1) * 0.1);

  const rtl = dir === 'rtl';
  // In RTL time runs right → left, matching how the rest of the UI reads.
  const plotStart = rtl ? W - PAD.start : PAD.start;
  const plotEnd = rtl ? PAD.end : W - PAD.end;
  const px = (v) => plotStart + ((v - x0) / spanX) * (plotEnd - plotStart);
  const py = (v) => H - PAD.bottom - ((v - y0) / spanY) * (H - PAD.top - PAD.bottom);

  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${px(+p.date).toFixed(1)},${py(p.value).toFixed(1)}`)
    .join(' ');
  const base = H - PAD.bottom;
  const area = `${path} L${px(x1).toFixed(1)},${base} L${px(x0).toFixed(1)},${base} Z`;

  // Axis numbers only — the unit is stated once in the heading, which keeps the
  // labels free of mixed-direction text inside the SVG.
  const axisX = rtl ? W - 4 : 4;
  const anchor = rtl ? 'end' : 'start';

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <clipPath id={clip}>
        <rect x="0" y="0" width={W} height={base + 1} />
      </clipPath>
      <line className="grid-l" x1="0" x2={W} y1={py(y1)} y2={py(y1)} />
      <line className="grid-l" x1="0" x2={W} y1={base} y2={base} />
      <g clipPath={`url(#${clip})`}>
        <path className="area" d={area} />
        <path className="line" d={path} />
      </g>
      {points.map((p, i) => (
        <circle key={i} className="pt" cx={px(+p.date)} cy={py(p.value)} r="2.8" />
      ))}
      <text x={axisX} y={py(y1) + 4} textAnchor={anchor} dir="ltr">
        {fmtNumber(y1, 1)}
      </text>
      {y0 !== y1 && (
        <text x={axisX} y={py(y0) - 3} textAnchor={anchor} dir="ltr">
          {fmtNumber(y0, 1)}
        </text>
      )}
      <text x={px(x0)} y={H - 10} textAnchor={rtl ? 'end' : 'start'}>
        {fmtDateShort(points[0].date)}
      </text>
      <text x={px(x1)} y={H - 10} textAnchor={rtl ? 'start' : 'end'}>
        {fmtDateShort(points[points.length - 1].date)}
      </text>
    </svg>
  );
}

/** Bar sparkline. Flexbox handles the mirroring: oldest sits on the start edge. */
export function Spark({ values, label }) {
  const max = Math.max(1, ...values);
  return (
    <div className="spark" role="img" aria-label={label}>
      {values.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(3, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }} />
      ))}
    </div>
  );
}

export function BarRow({ label, value, max, display }) {
  return (
    <div className="bar-row">
      <span className="lab" dir="auto">
        {label}
      </span>
      <span className="track">
        <span className="fill" style={{ inlineSize: `${Math.round((value / (max || 1)) * 100)}%` }} />
      </span>
      <span className="val">{display ?? value}</span>
    </div>
  );
}
