import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { PipelineBoard } from "./components/pipeline-board";
import type { IdeaWithExtras, StageMeta, CriterionMeta } from "./types";

export default async function LabPipelinePage({
  params,
}: {
  params: Promise<{ labId: string }>;
}) {
  const { labId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [{ data: lab }, { data: stages }, { data: deadlines }, { data: ideas }, { data: criteriaRows }, { data: users }] =
    await Promise.all([
      supabase.from("labs").select("categories").eq("id", labId).single(),
      supabase.from("stages").select("*").eq("lab_id", labId).order("position"),
      supabase.from("stage_deadlines").select("*").eq("lab_id", labId),
      supabase.from("ideas").select("*").eq("lab_id", labId).order("created_at"),
      supabase.from("rating_criteria").select("*").or(`lab_id.is.null,lab_id.eq.${labId}`),
      supabase.from("users").select("id, email"),
    ]);

  const ideaIds = (ideas ?? []).map((i) => i.id);

  const [{ data: ratingRows }, { data: commentRows }, { data: favoriteRows }, { data: requirementRows }] =
    await Promise.all([
      ideaIds.length
        ? supabase.from("ratings").select("*").in("idea_id", ideaIds)
        : Promise.resolve({ data: [] }),
      ideaIds.length
        ? supabase.from("comments").select("*").in("idea_id", ideaIds).order("created_at")
        : Promise.resolve({ data: [] }),
      ideaIds.length
        ? supabase.from("idea_favorites").select("*").in("idea_id", ideaIds)
        : Promise.resolve({ data: [] }),
      ideaIds.length
        ? supabase
            .from("idea_requirements")
            .select("*")
            .in("idea_id", ideaIds)
            .order("created_at")
        : Promise.resolve({ data: [] }),
    ]);

  const emailById = new Map((users ?? []).map((u) => [u.id, u.email]));
  const deadlineByStage = new Map((deadlines ?? []).map((d) => [d.stage_id, d.deadline_at]));

  const stageMetas: StageMeta[] = (stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    position: s.position,
    description: s.description,
    gateChecklist: Array.isArray(s.gate_checklist) ? s.gate_checklist : [],
    deadlineAt: deadlineByStage.get(s.id) ?? null,
  }));

  const criteria: CriterionMeta[] = (criteriaRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    scale: c.scale,
    labId: c.lab_id,
  }));

  const ideasWithExtras: IdeaWithExtras[] = (ideas ?? []).map((idea) => ({
    id: idea.id,
    labId: idea.lab_id,
    stageId: idea.stage_id,
    title: idea.title,
    category: idea.category,
    description: idea.description,
    pros: idea.pros,
    cons: idea.cons,
    stageData: idea.stage_data ?? {},
    createdByEmail: idea.created_by ? (emailById.get(idea.created_by) ?? null) : null,
    createdAt: idea.created_at,
    ratings: (ratingRows ?? [])
      .filter((r) => r.idea_id === idea.id)
      .map((r) => ({ criterionId: r.criterion_id, userId: r.user_id, score: r.score })),
    comments: (commentRows ?? [])
      .filter((c) => c.idea_id === idea.id)
      .map((c) => ({
        id: c.id,
        userId: c.user_id,
        authorEmail: emailById.get(c.user_id) ?? "unknown",
        body: c.body,
        createdAt: c.created_at,
      })),
    favoritedByCurrentUser: (favoriteRows ?? []).some(
      (f) => f.idea_id === idea.id && f.user_id === user.id,
    ),
    favoriteCount: (favoriteRows ?? []).filter((f) => f.idea_id === idea.id).length,
    requirements: (requirementRows ?? [])
      .filter((r) => r.idea_id === idea.id)
      .map((r) => ({
        id: r.id,
        userId: r.user_id,
        authorEmail: emailById.get(r.user_id) ?? "unknown",
        body: r.body,
        done: r.done,
        createdAt: r.created_at,
      })),
  }));

  return (
    <PipelineBoard
      labId={labId}
      stages={stageMetas}
      ideas={ideasWithExtras}
      criteria={criteria}
      currentUserId={user.id}
      isMaster={user.is_master}
      categories={lab?.categories ?? []}
    />
  );
}
