import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';

export function getSupabaseBrowserClient<GenericSchema = Database>() {
  return createBrowserClient<GenericSchema>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
