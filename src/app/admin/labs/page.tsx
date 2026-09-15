import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateLabForm } from "@/components/admin/create-lab-form";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AdminLabsPage() {
  const supabase = await createClient();
  const { data: labs } = await supabase
    .from("labs")
    .select("id, name, logo_url, primary_color")
    .order("name");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold">New lab</h2>
        <CreateLabForm />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">All labs</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {labs?.map((lab) => (
            <Link key={lab.id} href={`/admin/labs/${lab.id}`}>
              <Card
                className="h-full border-t-4 transition-shadow hover:shadow-md"
                style={{ borderTopColor: lab.primary_color }}
              >
                <CardHeader>
                  <CardTitle>{lab.name}</CardTitle>
                  <CardDescription>Manage stages, deadlines, members</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
