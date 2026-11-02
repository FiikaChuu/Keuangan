import { useId } from 'react';
import type { Transaction } from './domain';
import { money, compact, displayDate } from './domain';
import { cashflowBuckets } from './analytics';
import { MoneyAmount } from './MoneyAmount';

export function NetCashflowChart({
  transactions,
  days,
}: {
  transactions: Transaction[];
  days: number;
}) {
  const gradient = useId().replaceAll(':', '');
  const points = cashflowBuckets(transactions, days);
  const values = [0, ...points.map((p) => p.cumulative)];
  const high = Math.max(...values, 100000);
  const low = Math.min(...values, 0);
  const padding = (high - low) * 0.13;
  const max = high + padding,
    min = low - padding;
  const y = (value: number) => 180 - ((value - min) / (max - min)) * 155;
  const coords = [
    [48, y(0)],
    ...points.map((p, i) => [48 + ((i + 1) / points.length) * 642, y(p.cumulative)]),
  ];
  const path = coords
    .map((p, i) =>
      i
        ? `C ${coords[i - 1][0] + (p[0] - coords[i - 1][0]) / 3},${coords[i - 1][1]} ${p[0] - (p[0] - coords[i - 1][0]) / 3},${p[1]} ${p[0]},${p[1]}`
        : `M ${p[0]},${p[1]}`,
    )
    .join(' ');
  return (
    <div className="net-flow-chart">
      <div className="chart-current">
        <span>Selisih dalam periode</span>
        <strong className={points.at(-1)!.cumulative >= 0 ? 'positive' : 'negative'}>
          <MoneyAmount value={points.at(-1)!.cumulative} />
        </strong>
      </div>
      <svg
        viewBox="0 0 720 220"
        role="img"
        aria-label={`Grafik arus dana bersih ${days} hari, selisih ${money(points.at(-1)!.cumulative)}`}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ed0c2" stopOpacity=".13" />
            <stop offset="100%" stopColor="#3ed0c2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="48"
              x2="690"
              y1={25 + (i * 155) / 3}
              y2={25 + (i * 155) / 3}
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <text x="0" y={29 + (i * 155) / 3} fontSize="10" fill="var(--muted)">
              {compact(max - (i * (max - min)) / 3)}
            </text>
          </g>
        ))}
        <line
          x1="48"
          x2="690"
          y1={y(0)}
          y2={y(0)}
          stroke="var(--muted)"
          strokeOpacity=".3"
          strokeDasharray="4 5"
        />
        <path d={`${path} L 690,180 L 48,180 Z`} fill={`url(#${gradient})`} />
        <path d={path} stroke="#3ed0c2" strokeWidth="2.5" fill="none" />
        {coords.slice(1).map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r="6" fill="#3ed0c2" opacity=".2" />
            <circle cx={p[0]} cy={p[1]} r="2.5" fill="#3ed0c2" />
            <text
              x={p[0]}
              y="210"
              textAnchor={i === points.length - 1 ? 'end' : 'middle'}
              fontSize="10"
              fill="var(--muted)"
            >
              {displayDate(points[i].end, { day: 'numeric', month: 'short' })}
            </text>
            <title>
              {displayDate(points[i].end)}: {money(points[i].cumulative)}
            </title>
          </g>
        ))}
      </svg>
      <p className="chart-note">
        Akumulasi pemasukan dikurangi pengeluaran dan biaya admin. Transfer antar akun tidak
        menambah selisih.
      </p>
    </div>
  );
}
