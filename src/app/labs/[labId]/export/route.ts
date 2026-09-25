import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { DISTRIBUTION_CHANNELS } from "../stage-data";
import type {
  ShortlistData,
  ConceptData,
  PrototypingData,
  DistributionData,
} from "../stage-data";

// One identical column layout used on every stage's sheet ("same columns,
// separation into cards" — each stage is its own sheet, each idea a row).
// Every UGC element (comments, per-user requirements, ratings, favorites) is
// included so the export is a complete snapshot, not just the card fronts.
const BASE_COLUMNS = [
  "Title",
  "Category",
  "Description",
  "Pros",
  "Cons",
  "Created By",
  "Created At",
  "Favorites",
  "Shortlist Reasoning",
  "Concept: Place",
  "Concept: Story",
  "Concept: Operational Details",
  "Concept: Audience",
  "Concept: Notes",
  "Prototyping: Test Date",
  "Prototyping: Who We're Testing With",
  "Prototyping: MVP Description",
  "Prototyping: Results",
  "Distribution: Channels",
  "Distribution: Requirements",
  "Distribution: Todo",
];

function sheetNameFor(stageName: string, index: number) {
  // Excel sheet names: max 31 chars, no \ / ? * [ ] : — and must be unique.
  const cleaned = stageName.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
  return cleaned || `Stage ${index + 1}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ labId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not signed in", { status: 401 });

  const { labId } = await params;
  const supabase = await createClient();

  const { data: lab } = await supabase.from("labs").select("id, name").eq("id", labId).single();
  // RLS returns no row for labs the user can't access, same as a 404.
  if (!lab) return new NextResponse("Not found", { status: 404 });

  const [{ data: stages }, { data: ideas }, { data: criteriaRows }, { data: users }] =
    await Promise.all([
      supabase.from("stages").select("*").eq("lab_id", labId).order("position"),
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
  const criteriaNames = [...new Set((criteriaRows ?? []).map((c) => c.name))];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Saudi Experience Labs";
  workbook.created = new Date();

  const columns = [...BASE_COLUMNS, ...criteriaNames.map((n) => `Rating: ${n}`), "Requirements", "Comments"];

  for (const [index, stage] of (stages ?? []).entries()) {
    const sheet = workbook.addWorksheet(sheetNameFor(stage.name, index));
    sheet.columns = columns.map((header) => ({ header, key: header, width: 24 }));
    sheet.getRow(1).font = { bold: true };

    const stageIdeas = (ideas ?? []).filter((i) => i.stage_id === stage.id);

    for (const idea of stageIdeas) {
      const stageData = (idea.stage_data ?? {}) as {
        shortlist?: ShortlistData;
        concept?: ConceptData;
        prototyping?: PrototypingData;
        distribution?: DistributionData;
      };

      const ideaComments = (commentRows ?? []).filter((c) => c.idea_id === idea.id);
      const ideaRequirements = (requirementRows ?? []).filter((r) => r.idea_id === idea.id);
      const ideaFavoriteCount = (favoriteRows ?? []).filter((f) => f.idea_id === idea.id).length;
      const ideaRatings = (ratingRows ?? []).filter((r) => r.idea_id === idea.id);

      const ratingAverages = Object.fromEntries(
        criteriaNames.map((name) => {
          const criterionIds = (criteriaRows ?? [])
            .filter((c) => c.name === name)
            .map((c) => c.id);
          const scores = ideaRatings
            .filter((r) => criterionIds.includes(r.criterion_id))
            .map((r) => r.score);
          const avg = scores.length
            ? (scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(1)
            : "";
          return [`Rating: ${name}`, avg];
        }),
      );

      const distributionChannels = (stageData.distribution?.channels ?? [])
        .map((key) => DISTRIBUTION_CHANNELS.find((c) => c.key === key)?.label ?? key)
        .join(", ");

      const distributionTodo = (stageData.distribution?.todo ?? [])
        .map((t) => `[${t.done ? "x" : " "}] ${t.text}`)
        .join("\n");

      const requirementsText = ideaRequirements
        .map((r) => `[${r.done ? "x" : " "}] ${emailById.get(r.user_id) ?? "unknown"}: ${r.body}`)
        .join("\n");

      const commentsText = ideaComments
        .map((c) => `${emailById.get(c.user_id) ?? "unknown"} (${c.created_at}): ${c.body}`)
        .join("\n");

      sheet.addRow({
        Title: idea.title,
        Category: idea.category ?? "",
        Description: idea.description ?? "",
        Pros: idea.pros ?? "",
        Cons: idea.cons ?? "",
        "Created By": idea.created_by ? (emailById.get(idea.created_by) ?? "unknown") : "",
        "Created At": idea.created_at,
        Favorites: ideaFavoriteCount,
        "Shortlist Reasoning": stageData.shortlist?.reasoning ?? "",
        "Concept: Place": stageData.concept?.place ?? "",
        "Concept: Story": stageData.concept?.story ?? "",
        "Concept: Operational Details": stageData.concept?.operationalDetails ?? "",
        "Concept: Audience": stageData.concept?.audience ?? "",
        "Concept: Notes": stageData.concept?.notes ?? "",
        "Prototyping: Test Date": stageData.prototyping?.testDate ?? "",
        "Prototyping: Who We're Testing With": stageData.prototyping?.audienceTested ?? "",
        "Prototyping: MVP Description": stageData.prototyping?.mvpDescription ?? "",
        "Prototyping: Results": stageData.prototyping?.results ?? "",
        "Distribution: Channels": distributionChannels,
        "Distribution: Requirements": stageData.distribution?.requirements ?? "",
        "Distribution: Todo": distributionTodo,
        ...ratingAverages,
        Requirements: requirementsText,
        Comments: commentsText,
      });
    }

    for (const row of sheet.getRows(2, sheet.rowCount) ?? []) {
      row.alignment = { wrapText: true, vertical: "top" };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${lab.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "lab"}-export.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
