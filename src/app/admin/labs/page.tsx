import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateLabForm } from "@/components/admin/create-lab-form";
import { RemoveLabButton } from "@/components/admin/lab-card-actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

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
            <Card
              key={lab.id}
              className="h-full border-t-4"
              style={{ borderTopColor: lab.primary_color }}
            >
              <CardHeader>
                <CardTitle>{lab.name}</CardTitle>
                <CardDescription>Manage stages, deadlines, members</CardDescription>
              </CardHeader>
              <CardFooter className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button render={<Link href={`/admin/labs/${lab.id}`} />} size="sm" variant="outline">
                    Edit lab
                  </Button>
                  <Button
                    render={<Link href={`/admin/labs/${lab.id}#members`} />}
                    size="sm"
                    variant="ghost"
                  >
                    Add users
                  </Button>
                </div>
                <RemoveLabButton labId={lab.id} labName={lab.name} />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
