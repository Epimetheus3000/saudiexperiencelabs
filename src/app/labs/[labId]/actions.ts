"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";

function fail(message: string) {
  return { ok: false as const, error: message };
}
function ok() {
  return { ok: true as const };
}

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

  const { error } = await supabase.from("ideas").insert({
    lab_id: labId,
    stage_id: longlistStage.id,
    title: parsed.data.title,
    category: parsed.data.category || null,
    description: parsed.data.description || null,
    pros: parsed.data.pros || null,
    cons: parsed.data.cons || null,
    created_by: user.id,
  });

  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function moveIdea(
  ideaId: string,
  labId: string,
  newStageId: string,
  reasoning?: string,
) {
  const supabase = await createClient();

  const update: { stage_id: string; shortlist_reasoning?: string } = { stage_id: newStageId };
  if (reasoning !== undefined) update.shortlist_reasoning = reasoning;

  const { error } = await supabase.from("ideas").update(update).eq("id", ideaId);
  if (error) return fail(error.message);

  revalidatePath(`/labs/${labId}`);
  return ok();
}

const conceptSchema = z.object({
  concept_details: z.string().optional(),
  concept_audience: z.string().optional(),
  concept_notes: z.string().optional(),
});

export async function updateConceptFields(ideaId: string, labId: string, formData: FormData) {
  const parsed = conceptSchema.safeParse({
    concept_details: formData.get("concept_details"),
    concept_audience: formData.get("concept_audience"),
    concept_notes: formData.get("concept_notes"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("ideas")
    .update({
      concept_details: parsed.data.concept_details || null,
      concept_audience: parsed.data.concept_audience || null,
      concept_notes: parsed.data.concept_notes || null,
    })
    .eq("id", ideaId);

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
