import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 See Other: tells the browser to follow up with a GET. The default
  // 307 makes it re-POST to /login, which is a page and answers 405.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
