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
  const paths = name.includes('food') ? (
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
      width="26"
      height="26"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'Pengeluaran' ? (
        <path d="M7 21 21 7M9 7h12v12" />
      ) : kind === 'Pemasukan' ? (
        <path d="M21 7 7 21M7 9v12h12" />
      ) : kind === 'Transfer' ? (
        <path d="M4 9h20l-5-5M24 19H4l5 5" />
      ) : (
        <>
          <path d="M5 23V15m9 8V5m9 18V11" />
          <circle cx="5" cy="12" r="1" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
