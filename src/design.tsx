import { MeshIcon } from './MeshIcon';
import type { IconTone, IconVariant } from './MeshIcon';
import { memo, useEffect, useState } from 'react';
import { WalletGlyph } from './WalletArt';

// Transparent mesh-rendered artwork; surrounding controls retain their labels.
export const DesignIcon = memo(function DesignIcon({name,size=24,className='',tone,variant}:{name:string;size?:number;className?:string;tone?:IconTone;variant?:IconVariant}) {
 if(name.startsWith('category-') || name==='nav-capture') return <WalletGlyph name={name} size={size} className={className}/>;
 return <MeshIcon name={name} size={size} className={`design-icon ${className}`} tone={tone} variant={variant} aria-hidden="true"/>;
});

export const categoryArtwork: Record<string, string> = {
  Makan: 'category-food',
  Tagihan: 'category-utilities',
  'Makanan & minuman': 'category-food',
  Transportasi: 'category-transport',
  'Rumah & tagihan': 'category-home',
  'Kuota & internet': 'category-utilities',
  Hiburan: 'category-entertainment',
  Langganan: 'category-subscription',
  Kesehatan: 'category-health',
  Belanja: 'category-shopping',
  Pendidikan: 'category-education',
  Pasangan: 'category-relationship',
  Transfer: 'category-transfer',
  Pemasukan: 'stat-income',
  'Tarik tunai': 'nav-transactions',
  Lainnya: 'category-other',
};

// On an installed iPhone PWA, the OS supplies this safe area and system chrome.
export const DeviceStatus = memo(function DeviceStatus() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="device-status" aria-hidden="true">
      <span>
        {new Intl.DateTimeFormat('id-ID', { hour: 'numeric', minute: '2-digit', hour12: false })
          .format(time)
          .replace('.', ':')}
      </span>
      <DesignIcon name="status" size={76} />
    </div>
  );
});
