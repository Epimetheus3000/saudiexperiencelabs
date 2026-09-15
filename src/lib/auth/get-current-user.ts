import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, is_master, is_external")
    .eq("id", authUser.id)
    .single();

  return profile;
}
