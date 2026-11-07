import { memo, useMemo } from 'react';
import type { Store, Transaction } from './domain';
import { money, compact, displayDate, balanceHistory } from './domain';
import { cashflowBuckets } from './analytics';

type Point = [number, number];
const left = 23,
  right = 307,
  top = 4,
  bottom = 166;
const curve = (points: Point[]) =>
  points
    .map((p, i) =>
      i
        ? `C ${points[i - 1][0] + (p[0] - points[i - 1][0]) / 3},${points[i - 1][1]} ${p[0] - (p[0] - points[i - 1][0]) / 3},${p[1]} ${p[0]},${p[1]}`
        : `M ${p[0]},${p[1]}`,
    )
    .join(' ');
function Grid({ max, min = 0, dates }: { max: number; min?: number; dates: string[] }) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line
            x1={left}
            x2={right}
            y1={top + (i * (bottom - top)) / 4}
            y2={top + (i * (bottom - top)) / 4}
            stroke="var(--line)"
            strokeDasharray="1 2"
            strokeWidth=".5"
          />
          <text
            x={left - 4}
            y={top + 3 + (i * (bottom - top)) / 4}
            textAnchor="end"
            fontSize="9"
            fill="var(--muted)"
          >
            {compact(max - (i * (max - min)) / 4)}
          </text>
        </g>
      ))}
      {dates.map((date, i) => {
        const x = left + (i / (dates.length - 1)) * (right - left);
        return (
          <g key={i}>
            <line
              x1={x}
              x2={x}
              y1={top}
              y2={bottom}
              stroke="var(--line)"
              strokeDasharray="1 2"
              strokeWidth=".5"
            />
            <text
              x={x}
              y="183"
              textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
              fontSize="9"
              fill="var(--muted)"
            >
              {displayDate(date, { day: 'numeric', month: 'short' })}
            </text>
          </g>
        );
      })}
    </g>
  );
}
function Dots({ points, color }: { points: Point[]; color: string }) {
  return (
    <g>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="5" fill={color} opacity=".25" />
          <circle cx={p[0]} cy={p[1]} r="2" fill={color} />
        </g>
      ))}
    </g>
  );
}
export const BalanceChart = memo(function BalanceChart({
  store,
  days,
}: {
  store: Store;
  days: number;
}) {
  const history = useMemo(() => balanceHistory(store, days), [store, days]);
  const samples = Array.from(
    { length: 6 },
    (_, i) => history[Math.round((i * (history.length - 1)) / 5)],
  );
  const max = Math.max(...history.map((p) => p.value), 100000) * 1.1;
  const points: Point[] = samples.map((p, i) => [
    left + (i * (right - left)) / 5,
    bottom - (p.value / max) * (bottom - top),
  ]);
  return (
    <div className="reference-chart">
      <svg
        viewBox="0 0 309 190"
        role="img"
        aria-label={`Grafik total saldo ${days} hari terakhir, saldo saat ini ${money(history.at(-1)!.value)}`}
      >
        <Grid max={max} dates={samples.map((p) => p.date)} />
        <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#3ED0C2" strokeWidth="1" />
        <path d={curve(points)} fill="none" stroke="#3ED0C2" strokeWidth="1" />
        <Dots points={points} color="#3ED0C2" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="12" fill="transparent">
            <title>
              {displayDate(samples[i].date)}: {money(samples[i].value)}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
});
export const CashflowChart = memo(function CashflowChart({
  transactions,
  days,
}: {
  transactions: Transaction[];
  days: number;
}) {
  const buckets = useMemo(() => cashflowBuckets(transactions, days), [transactions, days]);
  const max = Math.max(...buckets.flatMap((b) => [b.income, b.expense]), 100000) * 1.15;
  const width = (right - left) / buckets.length;
  return (
    <div className="reference-chart">
      <svg
        viewBox="0 0 309 190"
        role="img"
        aria-label={`Grafik pemasukan hijau dan pengeluaran merah ${days} hari terakhir`}
      >
        <Grid max={max} dates={buckets.map((b) => b.end)} />
        {buckets.map((b, i) => (
          <g key={b.end}>
            {[
              ['income', '#7CCB8C'],
              ['expense', '#F37777'],
            ].map(([key, color], j) => {
              const value = b[key as 'income' | 'expense'];
              const height = (value / max) * (bottom - top);
              return (
                <rect
                  key={key}
                  x={left + i * width + width / 2 + (j === 0 ? -13 : 1)}
                  y={bottom - height}
                  width="12"
                  height={height}
                  rx="6"
                  fill={color}
                >
                  <title>
                    {key === 'income' ? 'Pemasukan' : 'Pengeluaran'} {displayDate(b.end)}:{' '}
                    {money(value)}
                  </title>
                </rect>
              );
            })}
          </g>
        ))}
        <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#3ED0C2" strokeWidth="1" />
      </svg>
    </div>
  );
});
export const NetCashflowChart = memo(function NetCashflowChart({
  transactions,
  days,
}: {
  transactions: Transaction[];
  days: number;
}) {
  const buckets = useMemo(() => cashflowBuckets(transactions, days), [transactions, days]);
  const max = Math.max(...buckets.flatMap((b) => [b.income, b.expense]), 100000) * 1.15;
  const zero = (top + bottom) / 2;
  const incoming: Point[] = buckets.map((b, i) => [
    left + (i * (right - left)) / (buckets.length - 1),
    zero - ((b.income / max) * (bottom - top)) / 2,
  ]);
  const outgoing: Point[] = buckets.map((b, i) => [
    left + (i * (right - left)) / (buckets.length - 1),
    zero + ((b.expense / max) * (bottom - top)) / 2,
  ]);
  return (
    <div className="reference-chart">
      <svg
        viewBox="0 0 309 190"
        role="img"
        aria-label={`Grafik arus dana ${days} hari: pemasukan di atas nol, pengeluaran di bawah nol`}
      >
        <Grid max={max} min={-max} dates={buckets.map((b) => b.end)} />
        <line x1={left} x2={right} y1={zero} y2={zero} stroke="#3ED0C2" strokeWidth="1" />
        <path d={curve(incoming)} fill="none" stroke="#3ED0C2" strokeWidth="1" />
        <Dots points={incoming} color="#3ED0C2" />
        <path d={curve(outgoing)} fill="none" stroke="#F37777" strokeWidth="1" />
        <Dots points={outgoing} color="#F37777" />
        {buckets.map((b, i) => (
          <rect
            key={b.end}
            x={left + (i * (right - left)) / (buckets.length - 1) - 12}
            y={top}
            width="24"
            height={bottom - top}
            fill="transparent"
          >
            <title>
              {displayDate(b.end)}: pemasukan {money(b.income)}, pengeluaran {money(b.expense)}
            </title>
          </rect>
        ))}
      </svg>
    </div>
  );
});
