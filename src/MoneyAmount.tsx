import { money } from './domain';
import { moneyParts } from './money';

export function MoneyAmount({
  value,
  compact = true,
  positiveSign = false,
}: {
  value: number;
  compact?: boolean;
  positiveSign?: boolean;
}) {
  const parts = moneyParts(value, compact);
  const sign = value < 0 ? '−' : value > 0 && positiveSign ? '+' : '';
  const exact = `${value > 0 && positiveSign ? '+' : ''}${money(value)}`.replace(/\s/g, ' ');
  return (
    <span className="money-amount" title={exact}>
      <span className="money-visual" aria-hidden="true">
        {sign && <span className="money-sign">{sign}</span>}
        <span className="money-currency">Rp</span>
        <span className="money-number">{parts.number}</span>
        {parts.unit && <span className="money-unit">{parts.unit}</span>}
      </span>
      <span className="money-readable">{exact}</span>
    </span>
  );
}
