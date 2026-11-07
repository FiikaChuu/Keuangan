import { createClient } from '@supabase/supabase-js';

// Capture invitation/recovery mode before the SDK consumes and clears the URL hash.
export const initialAuthRecovery =
  typeof window !== 'undefined' && /type=(recovery|invite)/.test(window.location.hash);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && publishableKey && !url.includes('YOUR-PROJECT')
    ? createClient(url, publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : null;
