import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Untyped until the Supabase project is linked and real types are generated
// (see src/lib/types/database.ts) — this version of postgrest-js expects a
// generated schema shape that's brittle to hand-write.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component without a mutable cookie store.
            // Safe to ignore as long as middleware.ts is refreshing sessions.
          }
        },
      },
    },
  );
}
