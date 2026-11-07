import { memo, useEffect, useState } from 'react';

// Assets extracted verbatim from the supplied Figma SVGs.
export const DesignIcon = memo(function DesignIcon({
  name,
  size = 24,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      className={`design-icon ${className}`}
      src={`/design/${name}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
});

export const categoryArtwork: Record<string, string> = {
  Makan: 'category-food',
  Tagihan: 'category-utilities',
  'Makanan & minuman': 'category-food',
  Transportasi: 'category-transport',
  'Rumah & tagihan': 'category-home',
  'Kuota & internet': 'category-utilities',
  Hiburan: 'category-entertainment',
  Langganan: 'category-entertainment',
  Kesehatan: 'category-health',
  Belanja: 'category-shopping',
  Pendidikan: 'category-education',
  Pasangan: 'category-home',
  Transfer: 'nav-transactions-active',
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
      <DesignIcon name="status-icons" size={76} />
    </div>
  );
});
