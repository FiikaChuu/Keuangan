import { MeshIcon } from './MeshIcon';
import { useId } from 'react';

/** Original SkyWallet artwork; no bank or token marks. */
export function WalletTexture() {
  const id = useId().replaceAll(':', '');
  return (
    <svg
      className="wallet-texture"
      viewBox="0 0 240 500"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <path
            d="M1 0v12M5 0v7M9 5v7"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            opacity=".65"
          />
        </pattern>
      </defs>
      <path d="M0 0h240v500H0z" fill={`url(#${id})`} />
      <g fill="#111111" transform="translate(46 28)">
        <path d="M0 0h44v44H0zM50 0h44v44H50zM0 50h44v44H0z" />
        <circle cx="72" cy="72" r="22" />
        <path d="M100 50h44v44h-44zM50 100h44v44H50z" />
      </g>
    </svg>
  );
}

const providerSlugs = ['seabank','bank-jago','bca','mandiri','bri','bni','ovo','dana','gopay','shopeepay','lainnya'];
const palettes = ['#ff8fba', '#ffba58', '#77dccc', '#9cacf9', '#d2ef75', '#ec8d6f'];
export function WalletGlyph({name='wallet',size=25,className=''}:{name?:string;size?:number;className?:string}) {
 const index = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0) % palettes.length;
 const slug=name.toLowerCase().replaceAll(' ','-');
 const semantic = name.startsWith('category-') || name==='nav-capture'
   ? name
   : providerSlugs.includes(slug) ? `provider-${slug}` : 'wallet';
 return <span className={`wallet-glyph ${className}`} style={{background: palettes[index]}}><MeshIcon name={semantic} size={size} aria-hidden="true" /></span>;
}
export function ActionGlyph({kind}:{kind:string}) {return <MeshIcon name={kind==='Pengeluaran'?'expense':kind==='Pemasukan'?'income':kind==='Transfer'?'transfer':'reports'} size={28} aria-hidden="true"/>;}
