import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditLabForm } from "./edit-lab-form";
import { StageManager } from "./stage-manager";
import { MembershipManager } from "./membership-manager";
import { LabCriteriaManager } from "./lab-criteria-manager";
import { Separator } from "@/components/ui/separator";

export default async function AdminLabDetailPage({
  params,
}: {
  params: Promise<{ labId: string }>;
}) {
  const { labId } = await params;
  const supabase = await createClient();

  const [{ data: lab }, { data: stages }, { data: deadlines }, { data: memberships }, { data: allUsers }, { data: criteria }] =
    await Promise.all([
      supabase.from("labs").select("*").eq("id", labId).single(),
      supabase.from("stages").select("*").eq("lab_id", labId).order("position"),
      supabase.from("stage_deadlines").select("*").eq("lab_id", labId),
      supabase
        .from("lab_memberships")
        .select("id, user_id, users(email, is_external)")
        .eq("lab_id", labId),
      supabase.from("users").select("id, email, is_external").order("email"),
      supabase.from("rating_criteria").select("id, name, scale").eq("lab_id", labId),
    ]);

  if (!lab) notFound();

  const deadlineByStage = new Map((deadlines ?? []).map((d) => [d.stage_id, d.deadline_at]));
  const stagesWithDeadline = (stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    position: s.position,
    description: s.description,
    gateChecklist: Array.isArray(s.gate_checklist) ? s.gate_checklist : [],
    deadline_at: deadlineByStage.get(s.id) ?? null,
  }));

  const members = (memberships ?? []).map((m) => {
    const u = m.users as unknown as { email: string; is_external: boolean } | null;
    return {
      membershipId: m.id,
      userId: m.user_id,
      email: u?.email ?? "unknown",
      isExternal: u?.is_external ?? false,
    };
  });

  const memberUserIds = new Set(members.map((m) => m.userId));
  const availableUsers = (allUsers ?? [])
    .filter((u) => !memberUserIds.has(u.id))
    .map((u) => ({ id: u.id, email: u.email, isExternal: u.is_external }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Branding</h2>
        <EditLabForm
          labId={lab.id}
          name={lab.name}
          primaryColor={lab.primary_color}
          logoUrl={lab.logo_url}
          partnerName={lab.partner_name}
          partnerLogoUrl={lab.partner_logo_url}
        />
      </div>

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Stages & deadlines</h2>
        <StageManager labId={lab.id} stages={stagesWithDeadline} />
      </div>

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Members</h2>
        <MembershipManager labId={lab.id} members={members} availableUsers={availableUsers} />
      </div>

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Lab-specific rating criteria</h2>
        <LabCriteriaManager labId={lab.id} criteria={criteria ?? []} />
      </div>
    </div>
  );
}
