import { createBrowserClient } from "@supabase/ssr";

// Untyped until the Supabase project is linked and real types are generated
// (see src/lib/types/database.ts) — this version of postgrest-js expects a
// generated schema shape that's brittle to hand-write.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
