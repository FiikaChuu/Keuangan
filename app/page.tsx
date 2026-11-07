import ClientApp from './client-app';
export const dynamic = 'force-dynamic';
export default function Page() {
  return <ClientApp demo={process.env.SKYWALLET_DEMO === 'true'} />;
}
