"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ListChecks,
  ListFilter,
  Lightbulb,
  FlaskConical,
  Rocket,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { moveIdea, updateStageData, toggleFavorite } from "@/app/labs/[labId]/actions";
import type { IdeaWithExtras, StageMeta, CriterionMeta } from "@/app/labs/[labId]/types";
import { IdeaCard } from "./idea-card";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { ReasoningDialog } from "./reasoning-dialog";
import { StageGateDialog, type GateField } from "./stage-gate-dialog";
import { Countdown } from "@/components/countdown";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STAGE_ICONS: Record<string, LucideIcon> = {
  Longlist: ListChecks,
  Shortlist: ListFilter,
  Concept: Lightbulb,
  "Prototyping / Field-Testing": FlaskConical,
  "Go-Live": Rocket,
  Distribution: Share2,
};

// Additional-details gate for the stages beyond Shortlist (which already has
// its own reasoning + checklist dialog). Go-Live is deliberately excluded —
// its checklist stays non-blocking per the earlier product decision recorded
// in PROJECT_NOTES. One or more required fields per stage, mirroring how
// Shortlist requires "reasoning" rather than every field in that section.
const STAGE_GATE_FIELDS: Record<
  string,
  { stageKey: "concept" | "prototyping" | "distribution"; field: string; label: string }[]
> = {
  Concept: [{ stageKey: "concept", field: "story", label: "Story" }],
  "Prototyping / Field-Testing": [
    { stageKey: "prototyping", field: "mvpDescription", label: "MVP description" },
    { stageKey: "prototyping", field: "audienceTested", label: "Who are we testing with?" },
  ],
  Distribution: [{ stageKey: "distribution", field: "requirements", label: "Requirements" }],
};

// The header sits in shared grid row 1 across every column (see
// PipelineBoard's render) so CSS Grid's native row-track sizing gives every
// column the same header height — driven by whichever column's title +
// description + countdown is tallest — without guessing a fixed pixel value.
function ColumnHeader({ stage, count }: { stage: StageMeta; count: number }) {
  const Icon = STAGE_ICONS[stage.name];
  const isLonglist = stage.name === "Longlist";

  return (
    <div
      className="flex w-72 shrink-0 flex-col items-stretch justify-start border px-3 py-3 text-white"
      style={{ backgroundColor: "var(--lab-primary)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-5" />}
          <h3 className="text-base font-bold tracking-tight">{stage.name}</h3>
        </div>
        <Badge className="bg-white text-[var(--lab-primary)]">
          {isLonglist ? `${count}/50` : count}
        </Badge>
      </div>
      <div className="mt-2">
        {stage.description && <p className="text-xs text-white/80">{stage.description}</p>}
        {stage.deadlineAt && (
          <p className="mt-1 text-xs text-white/80">
            <Countdown deadlineAt={stage.deadlineAt} />
          </p>
        )}
      </div>
    </div>
  );
}

function ColumnBand() {
  return <div className="pattern-strip h-1.5 w-72 shrink-0" aria-hidden />;
}

function ColumnBody({
  stage,
  ideas,
  labId,
  stages,
  criteria,
  currentUserId,
  isMaster,
  categories,
  onToggleFavorite,
}: {
  stage: StageMeta;
  ideas: IdeaWithExtras[];
  labId: string;
  stages: StageMeta[];
  criteria: CriterionMeta[];
  currentUserId: string;
  isMaster: boolean;
  categories: string[];
  onToggleFavorite: (ideaId: string, currentlyFavorited: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const isLonglist = stage.name === "Longlist";

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 min-h-0 shrink-0 flex-col gap-2 overflow-y-auto border bg-muted/30 p-2 ${
        isOver ? "ring-2 ring-[var(--lab-primary)]" : ""
      }`}
    >
      {isLonglist && (
        <CreateIdeaDialog labId={labId} longlistCount={ideas.length} categories={categories} />
      )}
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          labId={labId}
          stages={stages}
          criteria={criteria}
          currentUserId={currentUserId}
          isMaster={isMaster}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
      {ideas.length === 0 && !isLonglist && (
        <p className="px-1 py-4 text-center text-xs text-muted-foreground">No ideas here</p>
      )}
    </div>
  );
}

export function PipelineBoard({
  labId,
  stages,
  ideas,
  criteria,
  currentUserId,
  isMaster,
  categories,
}: {
  labId: string;
  stages: StageMeta[];
  ideas: IdeaWithExtras[];
  criteria: CriterionMeta[];
  currentUserId: string;
  isMaster: boolean;
  categories: string[];
}) {
  const [localIdeas, setLocalIdeas] = useState(ideas);
  // Reset during render (not an effect) when the server hands us a fresh
  // `ideas` array — e.g. after router.refresh() following a create.
  // Without this, localIdeas (seeded once at mount for optimistic drag
  // updates) never picks up ideas added or changed elsewhere.
  const [prevIdeas, setPrevIdeas] = useState(ideas);
  if (ideas !== prevIdeas) {
    setPrevIdeas(ideas);
    setLocalIdeas(ideas);
  }
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    ideaId: string;
    ideaTitle: string;
    targetStageId: string;
    targetStageName: string;
  } | null>(null);
  const [pendingGate, setPendingGate] = useState<{
    ideaId: string;
    ideaTitle: string;
    targetStageId: string;
    targetStageName: string;
    stageKey: "concept" | "prototyping" | "distribution";
    fields: GateField[];
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const longlistStage = stages.find((s) => s.name === "Longlist");
  const shortlistStage = stages.find((s) => s.name === "Shortlist");

  const ideasByStage = useMemo(() => {
    const map = new Map<string, IdeaWithExtras[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const idea of localIdeas) {
      map.get(idea.stageId)?.push(idea);
    }
    return map;
  }, [localIdeas, stages]);

  const activeIdea = localIdeas.find((i) => i.id === activeIdeaId) ?? null;

  function onDragStart(event: DragStartEvent) {
    setActiveIdeaId(String(event.active.id));
  }

  // Optimistic: apply the move to local state immediately, before the
  // network call resolves, and roll back only if the save actually fails.
  // Waiting for the round-trip first is what made drops feel slow.
  async function commitMove(
    ideaId: string,
    targetStageId: string,
    shortlistPatch?: { reasoning: string; checklist: Record<string, boolean> },
    extraStagePatch?: { stageKey: "concept" | "prototyping" | "distribution"; values: Record<string, string> },
  ) {
    const previous = localIdeas;
    setLocalIdeas((prev) =>
      prev.map((i) =>
        i.id === ideaId
          ? {
              ...i,
              stageId: targetStageId,
              stageData: {
                ...i.stageData,
                ...(shortlistPatch && {
                  shortlist: { ...i.stageData.shortlist, ...shortlistPatch },
                }),
                ...(extraStagePatch && {
                  [extraStagePatch.stageKey]: {
                    ...i.stageData[extraStagePatch.stageKey],
                    ...extraStagePatch.values,
                  },
                }),
              },
            }
          : i,
      ),
    );

    const result = await moveIdea(ideaId, labId, targetStageId, shortlistPatch);
    if (!result.ok) setLocalIdeas(previous);
    return result;
  }

  // Same optimistic pattern for favorites: instant visual feedback, only
  // reverted if the save fails.
  function commitToggleFavorite(ideaId: string, currentlyFavorited: boolean) {
    const previous = localIdeas;
    setLocalIdeas((prev) =>
      prev.map((i) =>
        i.id === ideaId
          ? {
              ...i,
              favoritedByCurrentUser: !currentlyFavorited,
              favoriteCount: i.favoriteCount + (currentlyFavorited ? -1 : 1),
            }
          : i,
      ),
    );
    toggleFavorite(ideaId, labId, currentlyFavorited).then((result) => {
      if (!result.ok) {
        setLocalIdeas(previous);
        toast.error(result.error);
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveIdeaId(null);
    const { active, over } = event;
    if (!over) return;

    const ideaId = String(active.id);
    const targetStageId = String(over.id);
    const idea = localIdeas.find((i) => i.id === ideaId);
    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!idea || !targetStage || idea.stageId === targetStageId) return;

    const needsReasoning =
      longlistStage &&
      targetStage.position > longlistStage.position &&
      !idea.stageData.shortlist?.reasoning;

    if (needsReasoning) {
      setPendingMove({
        ideaId,
        ideaTitle: idea.title,
        targetStageId,
        targetStageName: targetStage.name,
      });
      return;
    }

    const gateFields = STAGE_GATE_FIELDS[targetStage.name];
    if (gateFields) {
      const stageKey = gateFields[0].stageKey;
      const currentData = idea.stageData[stageKey] as Record<string, unknown> | undefined;
      const hasAllFields = gateFields.every((f) => currentData?.[f.field]);
      if (!hasAllFields) {
        setPendingGate({
          ideaId,
          ideaTitle: idea.title,
          targetStageId,
          targetStageName: targetStage.name,
          stageKey,
          fields: gateFields.map((f) => ({
            key: f.field,
            label: f.label,
            initialValue: (currentData?.[f.field] as string | undefined) ?? "",
          })),
        });
        return;
      }
    }

    commitMove(ideaId, targetStageId).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div
          className="grid flex-1 gap-x-4 gap-y-1.5 overflow-x-auto p-4"
          style={{
            gridTemplateColumns: `repeat(${stages.length}, 18rem)`,
            gridTemplateRows: "auto auto minmax(0, 1fr)",
          }}
        >
          {/* Same grid row for every column, so its height is set by
              whichever column's header content is tallest. */}
          {stages.map((stage) => (
            <ColumnHeader
              key={stage.id}
              stage={stage}
              count={ideasByStage.get(stage.id)?.length ?? 0}
            />
          ))}
          {stages.map((stage) => (
            <ColumnBand key={stage.id} />
          ))}
          {stages.map((stage) => (
            <ColumnBody
              key={stage.id}
              stage={stage}
              ideas={ideasByStage.get(stage.id) ?? []}
              labId={labId}
              stages={stages}
              criteria={criteria}
              currentUserId={currentUserId}
              isMaster={isMaster}
              categories={categories}
              onToggleFavorite={commitToggleFavorite}
            />
          ))}
        </div>

        <DragOverlay>
          {activeIdea && (
            <Card className="w-64 py-3 shadow-lg">
              <CardHeader className="px-3">
                <CardTitle className="text-sm font-medium">{activeIdea.title}</CardTitle>
              </CardHeader>
            </Card>
          )}
        </DragOverlay>
      </DndContext>

      {pendingMove && (
        <ReasoningDialog
          open
          ideaTitle={pendingMove.ideaTitle}
          targetStageName={pendingMove.targetStageName}
          checklistItems={shortlistStage?.gateChecklist ?? []}
          onCancel={() => setPendingMove(null)}
          onConfirm={async (reasoning, checklist) => {
            const result = await commitMove(pendingMove.ideaId, pendingMove.targetStageId, {
              reasoning,
              checklist,
            });
            if (result.ok) setPendingMove(null);
            return result;
          }}
        />
      )}

      {pendingGate && (
        <StageGateDialog
          open
          ideaTitle={pendingGate.ideaTitle}
          targetStageName={pendingGate.targetStageName}
          fields={pendingGate.fields}
          onCancel={() => setPendingGate(null)}
          onConfirm={async (values) => {
            // Both calls fire together — commitMove applies the move (plus
            // these field values) to local state immediately, so the board
            // updates instantly regardless of which network call lands
            // first.
            const [patchResult, moveResult] = await Promise.all([
              updateStageData(pendingGate.ideaId, labId, pendingGate.stageKey, values),
              commitMove(pendingGate.ideaId, pendingGate.targetStageId, undefined, {
                stageKey: pendingGate.stageKey,
                values,
              }),
            ]);
            if (!patchResult.ok) return patchResult;
            if (moveResult.ok) setPendingGate(null);
            return moveResult;
          }}
        />
      )}
    </div>
  );
}
