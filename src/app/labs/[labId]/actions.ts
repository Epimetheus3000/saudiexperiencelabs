"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { StageData } from "./stage-data";

function fail(message: string) {
  return { ok: false as const, error: message };
}
function ok() {
  return { ok: true as const };
}

const STAGE_KEYS = ["shortlist", "concept", "prototyping", "goLive", "distribution"] as const;
type StageKey = (typeof STAGE_KEYS)[number];

const ideaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().optional(),
  description: z.string().optional(),
  pros: z.string().optional(),
  cons: z.string().optional(),
});

export async function createIdea(labId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in");

  const parsed = ideaSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    pros: formData.get("pros"),
    cons: formData.get("cons"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: longlistStage } = await supabase
    .from("stages")
    .select("id")
    .eq("lab_id", labId)
    .eq("name", "Longlist")
    .single();

  if (!longlistStage) return fail("Longlist stage not found for this lab");

  const { data: inserted, error } = await supabase
    .from("ideas")
    .insert({
      lab_id: labId,
      stage_id: longlistStage.id,
      title: parsed.data.title,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      pros: parsed.data.pros || null,
      cons: parsed.data.cons || null,
      created_by: user.id,
    })
    .select("id, created_at")
    .single();

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return { ok: true as const, idea: { id: inserted.id, createdAt: inserted.created_at } };
}

async function readStageData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ideaId: string,
): Promise<StageData> {
  const { data } = await supabase.from("ideas").select("stage_data").eq("id", ideaId).single();
  return (data?.stage_data as StageData) ?? {};
}

export async function moveIdea(
  ideaId: string,
  labId: string,
  newStageId: string,
  shortlistPatch?: { reasoning: string; checklist: Record<string, boolean> },
) {
  const supabase = await createClient();

  const update: { stage_id: string; stage_data?: StageData } = { stage_id: newStageId };

  if (shortlistPatch) {
    const current = await readStageData(supabase, ideaId);
    update.stage_data = { ...current, shortlist: { ...current.shortlist, ...shortlistPatch } };
  }

  const { error } = await supabase.from("ideas").update(update).eq("id", ideaId);
  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

// Generic merge-patch for one stage's slice of stage_data — used for Concept,
// Prototyping, Go-Live checklist toggles, and Distribution.
export async function updateStageData(
  ideaId: string,
  labId: string,
  stageKey: StageKey,
  patch: Record<string, unknown>,
) {
  if (!STAGE_KEYS.includes(stageKey)) return fail("Unknown stage");

  const supabase = await createClient();
  const current = await readStageData(supabase, ideaId);
  const merged: StageData = { ...current, [stageKey]: { ...current[stageKey], ...patch } };

  const { error } = await supabase.from("ideas").update({ stage_data: merged }).eq("id", ideaId);
  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function upsertRating(
  ideaId: string,
  labId: string,
  criterionId: string,
  score: number,
) {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in");

  const supabase = await createClient();
  const { error } = await supabase
    .from("ratings")
    .upsert(
      { idea_id: ideaId, criterion_id: criterionId, user_id: user.id, score },
      { onConflict: "idea_id,criterion_id,user_id" },
    );

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function addComment(ideaId: string, labId: string, body: string) {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in");

  const trimmed = body.trim();
  if (!trimmed) return fail("Comment can't be empty");

  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .insert({ idea_id: ideaId, user_id: user.id, body: trimmed });

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function toggleFavorite(ideaId: string, labId: string, favorited: boolean) {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in");

  const supabase = await createClient();
  const { error } = favorited
    ? await supabase
        .from("idea_favorites")
        .delete()
        .eq("idea_id", ideaId)
        .eq("user_id", user.id)
    : await supabase.from("idea_favorites").insert({ idea_id: ideaId, user_id: user.id });

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function addRequirement(ideaId: string, labId: string, body: string) {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in");

  const trimmed = body.trim();
  if (!trimmed) return fail("Requirement can't be empty");

  const supabase = await createClient();
  const { error } = await supabase
    .from("idea_requirements")
    .insert({ idea_id: ideaId, user_id: user.id, body: trimmed });

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function toggleRequirement(requirementId: string, labId: string, done: boolean) {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in");

  const supabase = await createClient();
  const { error } = await supabase
    .from("idea_requirements")
    .update({ done })
    .eq("id", requirementId);

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function removeRequirement(requirementId: string, labId: string) {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in");

  const supabase = await createClient();
  const { error } = await supabase.from("idea_requirements").delete().eq("id", requirementId);

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function deleteIdea(ideaId: string, labId: string) {
  const user = await getCurrentUser();
  if (!user) return fail("Not signed in");
  if (!user.is_master) return fail("Only a Master can remove an idea");

  const supabase = await createClient();
  const { error } = await supabase.from("ideas").delete().eq("id", ideaId);

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}
