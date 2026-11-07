'use client';
import dynamic from 'next/dynamic';
const Application = dynamic(() => import('../src/Application'), { ssr: false });
export default function ClientApp({ demo }: { demo: boolean }) {
  return <Application demo={demo} />;
}
