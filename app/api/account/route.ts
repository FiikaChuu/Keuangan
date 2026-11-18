import { deleteOwnAccount } from '../../../src/account-delete';

export const runtime = 'nodejs';
export async function DELETE(request: Request) {
  if (process.env.NEXT_PUBLIC_ACCOUNT_LIFECYCLE_ENABLED !== 'true')
    return Response.json({ code: 'PREVIEW_DISABLED', message: 'Belum diaktifkan pada preview' }, { status: 503 });
  return deleteOwnAccount(request, {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
