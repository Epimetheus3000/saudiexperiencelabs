import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Uses the service_role key and bypasses RLS entirely — server-only, and every
// caller MUST call requireMaster() first. Never import this from client code.
// Untyped for the same reason as lib/supabase/server.ts.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
