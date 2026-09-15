import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { SignOutButton } from "@/components/sign-out-button";

export default async function LabLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ labId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { labId } = await params;
  const supabase = await createClient();
  const { data: lab } = await supabase
    .from("labs")
    .select("id, name, logo_url, primary_color")
    .eq("id", labId)
    .single();

  // RLS returns no row for labs the user can't access, same as a 404.
  if (!lab) notFound();

  return (
    <div
      className="flex flex-1 flex-col"
      style={
        {
          "--lab-primary": lab.primary_color,
        } as React.CSSProperties
      }
    >
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          {lab.logo_url && (
            <Image
              src={lab.logo_url}
              alt={lab.name}
              width={32}
              height={32}
              className="rounded"
              unoptimized
            />
          )}
          <div>
            <Link href="/" className="text-xs text-muted-foreground hover:underline">
              ← All labs
            </Link>
            <h1 className="text-lg font-semibold" style={{ color: "var(--lab-primary)" }}>
              {lab.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user.is_master && (
            <Link
              href={`/admin/labs/${lab.id}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              Lab settings
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
