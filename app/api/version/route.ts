export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? 'development' }, {
    headers: { 'Cache-Control': 'no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' },
  });
}
