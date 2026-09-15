import { createClient } from "@/lib/supabase/server";
import { LabCriteriaManager } from "@/app/admin/labs/[labId]/lab-criteria-manager";

export default async function AdminCriteriaPage() {
  const supabase = await createClient();
  const { data: criteria } = await supabase
    .from("rating_criteria")
    .select("id, name, scale")
    .is("lab_id", null)
    .order("name");

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Global rating criteria</h2>
        <p className="text-sm text-muted-foreground">
          Applied to every lab&apos;s Concept stage, in addition to any lab-specific criteria.
        </p>
      </div>
      <LabCriteriaManager
        labId={null}
        criteria={criteria ?? []}
        emptyMessage="No global criteria defined yet."
      />
    </div>
  );
}
