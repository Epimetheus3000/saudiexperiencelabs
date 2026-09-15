"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMaster } from "@/lib/auth/require-master";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(message: string) {
  return { ok: false as const, error: message };
}
function ok() {
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Labs
// ---------------------------------------------------------------------------

const labSchema = z.object({
  name: z.string().min(1, "Name is required"),
  primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #0f172a"),
  logo_url: z.string().url().optional().or(z.literal("")),
});

export async function createLab(formData: FormData) {
  await requireMaster();
  const parsed = labSchema.safeParse({
    name: formData.get("name"),
    primary_color: formData.get("primary_color"),
    logo_url: formData.get("logo_url"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("labs").insert({
    name: parsed.data.name,
    primary_color: parsed.data.primary_color,
    logo_url: parsed.data.logo_url || null,
  });
  if (error) return fail(error.message);

  revalidatePath("/admin/labs");
  revalidatePath("/");
  return ok();
}

export async function updateLab(labId: string, formData: FormData) {
  await requireMaster();
  const parsed = labSchema.safeParse({
    name: formData.get("name"),
    primary_color: formData.get("primary_color"),
    logo_url: formData.get("logo_url"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("labs")
    .update({
      name: parsed.data.name,
      primary_color: parsed.data.primary_color,
      logo_url: parsed.data.logo_url || null,
    })
    .eq("id", labId);
  if (error) return fail(error.message);

  revalidatePath(`/admin/labs/${labId}`);
  revalidatePath("/");
  return ok();
}

// ---------------------------------------------------------------------------
// Stages & deadlines
// ---------------------------------------------------------------------------

export async function createStage(labId: string, formData: FormData) {
  await requireMaster();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Stage name is required");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("stages")
    .select("position")
    .eq("lab_id", labId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? 0) + 1;

  const { error } = await supabase
    .from("stages")
    .insert({ lab_id: labId, name, position: nextPosition });
  if (error) return fail(error.message);

  revalidatePath(`/admin/labs/${labId}`);
  revalidatePath(`/labs/${labId}`);
  return ok();
}

export async function setStageDeadline(
  labId: string,
  stageId: string,
  deadlineAt: string | null,
) {
  await requireMaster();
  const supabase = await createClient();
  const { error } = await supabase
    .from("stage_deadlines")
    .upsert({ stage_id: stageId, lab_id: labId, deadline_at: deadlineAt });
  if (error) return fail(error.message);

  revalidatePath(`/admin/labs/${labId}`);
  revalidatePath(`/labs/${labId}`);
  return ok();
}

// ---------------------------------------------------------------------------
// Rating criteria
// ---------------------------------------------------------------------------

export async function createRatingCriterion(formData: FormData) {
  await requireMaster();
  const name = String(formData.get("name") ?? "").trim();
  const scale = Number(formData.get("scale") ?? 5);
  const labIdRaw = String(formData.get("lab_id") ?? "");
  const labId = labIdRaw === "" ? null : labIdRaw;

  if (!name) return fail("Criterion name is required");
  if (!Number.isInteger(scale) || scale < 2 || scale > 10) {
    return fail("Scale must be a whole number between 2 and 10");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rating_criteria")
    .insert({ name, scale, lab_id: labId });
  if (error) return fail(error.message);

  revalidatePath("/admin/criteria");
  if (labId) revalidatePath(`/admin/labs/${labId}`);
  return ok();
}

export async function deleteRatingCriterion(criterionId: string, labId: string | null) {
  await requireMaster();
  const supabase = await createClient();
  const { error } = await supabase.from("rating_criteria").delete().eq("id", criterionId);
  if (error) return fail(error.message);

  revalidatePath("/admin/criteria");
  if (labId) revalidatePath(`/admin/labs/${labId}`);
  return ok();
}

// ---------------------------------------------------------------------------
// Users & memberships
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  isExternal: z.boolean(),
});

export async function inviteUser(formData: FormData) {
  await requireMaster();
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    isExternal: formData.get("role") === "partner",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email);
  if (error) return fail(error.message);

  if (parsed.data.isExternal && data.user) {
    const { error: updateError } = await admin
      .from("users")
      .update({ is_external: true })
      .eq("id", data.user.id);
    if (updateError) return fail(updateError.message);
  }

  revalidatePath("/admin/users");
  return ok();
}

export async function removeUser(userId: string) {
  const currentUser = await requireMaster();
  if (currentUser.id === userId) return fail("You can't remove your own account");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return fail(error.message);

  revalidatePath("/admin/users");
  return ok();
}

export async function addMembership(userId: string, labId: string) {
  await requireMaster();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lab_memberships")
    .insert({ user_id: userId, lab_id: labId });
  if (error) return fail(error.message);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/labs/${labId}`);
  return ok();
}

export async function removeMembership(membershipId: string, labId: string) {
  await requireMaster();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lab_memberships")
    .delete()
    .eq("id", membershipId);
  if (error) return fail(error.message);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/labs/${labId}`);
  return ok();
}
