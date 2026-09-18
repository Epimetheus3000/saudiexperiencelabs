import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: labs } = await supabase
    .from("labs")
    .select("id, name, logo_url, primary_color, partner_name")
    .order("name");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Saudi Experience Labs</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.is_master && (
            <Button render={<Link href="/admin" />} variant="outline" size="sm">
              Admin
            </Button>
          )}
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 p-6">
        {!labs || labs.length === 0 ? (
          <p className="text-muted-foreground">
            You don&apos;t have access to any labs yet. Ask your admin to add you to one.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labs.map((lab) => (
              <Link key={lab.id} href={`/labs/${lab.id}`}>
                <Card
                  className="h-full transition-shadow hover:shadow-md border-t-4"
                  style={{ borderTopColor: lab.primary_color }}
                >
                  <CardHeader>
                    <CardTitle>{lab.name}</CardTitle>
                    <CardDescription>
                      {lab.partner_name ? `with ${lab.partner_name}` : "Open pipeline"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
