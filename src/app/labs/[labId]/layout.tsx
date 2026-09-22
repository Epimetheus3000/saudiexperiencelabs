import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { SignOutButton } from "@/components/sign-out-button";
import { SquareCorners } from "@/components/square-corners";

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
    .select("id, name, logo_url, primary_color, partner_name, partner_logo_url")
    .eq("id", labId)
    .single();

  // RLS returns no row for labs the user can't access, same as a 404.
  if (!lab) notFound();

  return (
    <div
      className="flex flex-1 flex-col pb-3"
      style={
        {
          "--lab-primary": lab.primary_color,
          "--strip-color": lab.primary_color,
        } as React.CSSProperties
      }
    >
      <SquareCorners />
      {/* Background stays white per the brand guidelines (only purple, white,
          or imagery are permitted as backgrounds) — per-lab identity comes
          from the accent-colored text/border and the Strip pattern band
          below, not a tinted background fill. */}
      <header className="flex items-center justify-between gap-4 bg-background px-6 py-5">
        <div className="flex items-center gap-4">
          {lab.logo_url && (
            <Image
              src={lab.logo_url}
              alt={lab.name}
              width={56}
              height={56}
              className="size-14 object-contain"
              unoptimized
            />
          )}
          <div>
            <Link href="/" className="text-xs text-muted-foreground hover:underline">
              ← All labs
            </Link>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: "var(--lab-primary)" }}
            >
              {lab.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {lab.partner_name && (
            <div className="flex items-center gap-3 border border-border bg-muted/40 px-3 py-2">
              {lab.partner_logo_url ? (
                <Image
                  src={lab.partner_logo_url}
                  alt={lab.partner_name}
                  width={40}
                  height={40}
                  className="size-10 object-contain"
                  unoptimized
                />
              ) : (
                <div
                  className="flex size-10 items-center justify-center border border-dashed text-xs text-muted-foreground"
                  title="Partner logo pending"
                >
                  ?
                </div>
              )}
              <div className="leading-tight">
                <p className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                  In partnership with
                </p>
                <p className="text-sm font-semibold">{lab.partner_name}</p>
              </div>
            </div>
          )}

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
        </div>
      </header>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      {/* Fixed to the viewport, not the page — a persistent brand accent
          rather than a divider that just scrolls away with the header. */}
      <div className="pattern-strip fixed inset-x-0 bottom-0 z-10 h-3" aria-hidden />
    </div>
  );
}
