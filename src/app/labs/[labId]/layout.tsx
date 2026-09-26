import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { LabHeaderMenu } from "@/components/lab-header-menu";
import { SquareCorners } from "@/components/square-corners";

// Lab names are free-text set by admins (some stored ALL CAPS) — normalize
// to Title Case for display here rather than relying on CSS text-transform,
// which can't turn "ALL CAPS" into "All Caps" on its own.
function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

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
      {/* Saudi Experience Labs brand mark, locked to the top-left corner of
          the viewport regardless of scroll — distinct from the per-lab
          identity (accent color, lab logo) that follows in the header. */}
      <div className="fixed top-0 left-0 z-20 flex h-24 w-28 items-center justify-center overflow-hidden">
        <div
          className="pattern-strip absolute inset-0"
          style={{ "--strip-color": "var(--brand-purple-dark)" } as React.CSSProperties}
          aria-hidden
        />
        <Image
          src="/brand/saudi-experience-labs-logo.png"
          alt="Saudi Experience Labs"
          width={747}
          height={243}
          className="relative z-10 h-9 w-auto"
          priority
        />
      </div>
      {/* Background stays white per the brand guidelines (only purple, white,
          or imagery are permitted as backgrounds) — per-lab identity comes
          from the accent-colored text/border and the Strip pattern band
          below, not a tinted background fill. */}
      <header className="flex items-center justify-between gap-4 bg-background py-5 pr-6 pl-36">
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
            <h1 className="text-lg font-semibold text-gray-600">{toTitleCase(lab.name)}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {lab.partner_name && (
            <div
              className="flex items-center gap-4 border-l-4 bg-muted/40 py-2 pr-4 pl-4"
              style={{ borderLeftColor: "var(--lab-primary)" }}
            >
              {lab.partner_logo_url ? (
                <Image
                  src={lab.partner_logo_url}
                  alt={lab.partner_name}
                  width={64}
                  height={64}
                  className="size-16 object-contain"
                  unoptimized
                />
              ) : (
                <div
                  className="flex size-16 items-center justify-center border border-dashed text-base text-muted-foreground"
                  title="Partner logo pending"
                >
                  ?
                </div>
              )}
              <div className="leading-tight">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  In partnership with
                </p>
                <p className="text-xl font-bold">{lab.partner_name}</p>
              </div>
            </div>
          )}

          <LabHeaderMenu labId={lab.id} isMaster={user.is_master} />
        </div>
      </header>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      {/* Fixed to the viewport, not the page — a persistent brand accent
          rather than a divider that just scrolls away with the header. */}
      <div className="pattern-strip fixed inset-x-0 bottom-0 z-10 h-3" aria-hidden />
    </div>
  );
}
