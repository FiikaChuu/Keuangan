import { useId } from 'react';

/** Original SkyWallet artwork; no bank or token marks. */
export function WalletTexture() {
  const id = useId().replaceAll(':', '');
  return (
    <svg
      className="wallet-texture"
      viewBox="0 0 1000 380"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width="19" height="19" patternUnits="userSpaceOnUse">
          <path
            d="M0 1h11v7h8M1 10v9h10"
            fill="none"
            stroke="white"
            strokeWidth="1"
            opacity=".48"
          />
        </pattern>
      </defs>
      <path d="M450 0h550v380H570L760 190Z" fill={`url(#${id})`} />
      <g fill="#111111" transform="translate(824 48)">
        <path d="M0 0h30v30H0zM36 0h30v30H36zM0 36h30v30H0zM36 36h30v30H36z" />
        <path d="M72 36h30v30H72zM36 72h30v30H36z" />
      </g>
    </svg>
  );
}

const palettes = ['#ff8fba', '#ffba58', '#77dccc', '#9cacf9', '#d2ef75', '#ec8d6f'];
export function WalletGlyph({ name = 'wallet', size = 25 }: { name?: string; size?: number }) {
  const index = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % palettes.length;
  const category = name.includes('category');
  const paths = name.includes('transfer') ? (
    <path
      d="M4 10h22l-5-5M28 22H6l5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ) : name.includes('saving') ? (
    <>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="m16 16 10-10m-5 0h5v5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </>
  ) : name.includes('together') ? (
    <>
      <circle cx="11" cy="10" r="5" />
      <circle cx="23" cy="12" r="4" />
      <path d="M2 27v-4a9 9 0 0 1 18 0v4Zm20 0v-4a11 11 0 0 0-2-6 7 7 0 0 1 10 6v4Z" />
    </>
  ) : name.includes('utilities') ? (
    <path d="M8 3h16v26l-4-2-4 2-4-2-4 2Zm4 6v3h8V9Zm0 7v3h8v-3Z" fillRule="evenodd" />
  ) : name.includes('education') ? (
    <>
      <path d="m2 11 14-7 14 7-14 7Zm6 7 8 4 8-4v6l-8 4-8-4Z" />
      <path d="M28 12v10" stroke="currentColor" strokeWidth="2" />
    </>
  ) : name.includes('other') ? (
    <>
      <rect x="5" y="5" width="9" height="9" rx="2" />
      <rect x="18" y="5" width="9" height="9" rx="2" />
      <rect x="5" y="18" width="9" height="9" rx="2" />
      <rect x="18" y="18" width="9" height="9" rx="2" />
    </>
  ) : name.includes('food') ? (
    <>
      <path d="M6 13h20a10 10 0 0 1-20 0Z" />
      <path d="M11 5v4m5-6v6m5-4v4" stroke="currentColor" strokeWidth="2" />
    </>
  ) : name.includes('transport') ? (
    <>
      <path d="m6 10 3-5h14l3 5v12H6Z" />
      <path d="M9 11h14v6H9Z" fill="var(--avatar-fill)" />
      <circle cx="10" cy="24" r="3" />
      <circle cx="22" cy="24" r="3" />
    </>
  ) : name.includes('health') ? (
    <path d="M12 4h8v8h8v8h-8v8h-8v-8H4v-8h8Z" />
  ) : name.includes('shopping') ? (
    <>
      <path d="M6 11h20l2 17H4Z" />
      <path d="M11 12V8a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ) : name.includes('home') ? (
    <path d="m3 15 13-12 13 12h-4v14h-7v-9h-4v9H7V15Z" />
  ) : category ? (
    <>
      <path d="m16 3 4 8 9 5-9 4-4 9-5-9-8-4 8-5Z" />
      <circle cx="16" cy="16" r="3" fill="var(--avatar-fill)" />
    </>
  ) : (
    <>
      <rect x="3" y="7" width="26" height="21" rx="5" />
      <path d="m7 7 16-4v4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="20" y="14" width="10" height="8" rx="3" fill="var(--avatar-fill)" />
      <circle cx="24" cy="18" r="1.5" />
    </>
  );
  return (
    <span
      className="wallet-glyph"
      style={
        { background: palettes[index], '--avatar-fill': palettes[index] } as React.CSSProperties
      }
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
        {paths}
      </svg>
    </span>
  );
}

export function ActionGlyph({ kind }: { kind: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'Pengeluaran' ? (
        // A payment card: expenditure, not a bank connection.
        <path
          fill="currentColor"
          fillRule="evenodd"
          stroke="none"
          d="M6 5.5h16A3.5 3.5 0 0 1 25.5 9v10a3.5 3.5 0 0 1-3.5 3.5H6A3.5 3.5 0 0 1 2.5 19V9A3.5 3.5 0 0 1 6 5.5ZM5 10v2.5h18V10H5Zm1 7v2h6v-2H6Z"
        />
      ) : kind === 'Pemasukan' ? (
        <path
          fill="currentColor"
          fillRule="evenodd"
          stroke="none"
          d="M14 2a12 12 0 1 1 0 24 12 12 0 0 1 0-24Zm-1.25 5v9.2l-3.1-3.1-1.8 1.8L14 21l6.15-6.1-1.8-1.8-3.1 3.1V7h-2.5Z"
        />
      ) : kind === 'Transfer' ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M24.6 3.4a1.3 1.3 0 0 0-1.4-.3L3.7 11a1.3 1.3 0 0 0 .1 2.5l7.1 2 2 7.1a1.3 1.3 0 0 0 2.5.1l7.9-19.5a1.3 1.3 0 0 0-.3-1.4ZM12.3 14.1l-5-1.4 12.3-5-7.3 6.4Zm3 5.6-1.4-5 6.4-7.3-5 12.3Z"
        />
      ) : (
        // Frame language from the reference, with a chart rather than a scan symbol.
        <>
          <path d="M9 3.5H4v5.5m15-5.5h5V9M4 19v5.5h5m10 0h5V19" />
          <path d="M9 18v-4m5 4V9m5 9v-6" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
