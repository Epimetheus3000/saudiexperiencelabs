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
import { moveIdea, updateStageData } from "@/app/labs/[labId]/actions";
import type { IdeaWithExtras, StageMeta, CriterionMeta } from "@/app/labs/[labId]/types";
import type { ConceptData, PrototypingData, DistributionData } from "@/app/labs/[labId]/stage-data";
import { IdeaCard } from "./idea-card";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { ReasoningDialog } from "./reasoning-dialog";
import { StageGateDialog } from "./stage-gate-dialog";
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
// in PROJECT_NOTES. One required field per stage, mirroring how Shortlist
// only requires "reasoning" rather than every field in that section.
const STAGE_GATE_FIELD: Record<
  string,
  { stageKey: "concept" | "prototyping" | "distribution"; field: string; label: string }
> = {
  Concept: { stageKey: "concept", field: "story", label: "Story" },
  "Prototyping / Field-Testing": {
    stageKey: "prototyping",
    field: "mvpDescription",
    label: "MVP description",
  },
  Distribution: { stageKey: "distribution", field: "requirements", label: "Requirements" },
};

function Column({
  stage,
  ideas,
  labId,
  stages,
  criteria,
  currentUserId,
  isMaster,
  categories,
}: {
  stage: StageMeta;
  ideas: IdeaWithExtras[];
  labId: string;
  stages: StageMeta[];
  criteria: CriterionMeta[];
  currentUserId: string;
  isMaster: boolean;
  categories: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const Icon = STAGE_ICONS[stage.name];
  const isLonglist = stage.name === "Longlist";

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col border bg-muted/30 ${
        isOver ? "ring-2 ring-[var(--lab-primary)]" : ""
      }`}
    >
      <div className="px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="size-5" style={{ color: "var(--lab-primary)" }} />}
            <h3 className="text-base font-bold tracking-tight">{stage.name}</h3>
          </div>
          <Badge
            className="text-white"
            style={{ backgroundColor: "var(--lab-primary)" }}
          >
            {isLonglist ? `${ideas.length}/50` : ideas.length}
          </Badge>
        </div>
        {stage.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{stage.description}</p>
        )}
        {stage.deadlineAt && (
          <p className="mt-1 text-xs">
            <Countdown deadlineAt={stage.deadlineAt} />
          </p>
        )}
      </div>
      <div className="pattern-strip h-1.5 w-full" aria-hidden />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
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
          />
        ))}
        {ideas.length === 0 && !isLonglist && (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">No ideas here</p>
        )}
      </div>
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
    field: string;
    fieldLabel: string;
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

  async function commitMove(
    ideaId: string,
    targetStageId: string,
    shortlistPatch?: { reasoning: string; checklist: Record<string, boolean> },
  ) {
    const result = await moveIdea(ideaId, labId, targetStageId, shortlistPatch);
    if (result.ok) {
      setLocalIdeas((prev) =>
        prev.map((i) =>
          i.id === ideaId
            ? {
                ...i,
                stageId: targetStageId,
                stageData: shortlistPatch
                  ? { ...i.stageData, shortlist: { ...i.stageData.shortlist, ...shortlistPatch } }
                  : i.stageData,
              }
            : i,
        ),
      );
    }
    return result;
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

    const gate = STAGE_GATE_FIELD[targetStage.name];
    if (gate) {
      const currentValue = (idea.stageData[gate.stageKey] as Record<string, unknown> | undefined)?.[
        gate.field
      ];
      if (!currentValue) {
        setPendingGate({
          ideaId,
          ideaTitle: idea.title,
          targetStageId,
          targetStageName: targetStage.name,
          stageKey: gate.stageKey,
          field: gate.field,
          fieldLabel: gate.label,
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
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              ideas={ideasByStage.get(stage.id) ?? []}
              labId={labId}
              stages={stages}
              criteria={criteria}
              currentUserId={currentUserId}
              isMaster={isMaster}
              categories={categories}
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
          fieldLabel={pendingGate.fieldLabel}
          onCancel={() => setPendingGate(null)}
          onConfirm={async (value) => {
            const patchResult = await updateStageData(pendingGate.ideaId, labId, pendingGate.stageKey, {
              [pendingGate.field]: value,
            });
            if (!patchResult.ok) return patchResult;

            const moveResult = await commitMove(pendingGate.ideaId, pendingGate.targetStageId);
            if (moveResult.ok) {
              setLocalIdeas((prev) =>
                prev.map((i) =>
                  i.id === pendingGate.ideaId
                    ? {
                        ...i,
                        stageData: {
                          ...i.stageData,
                          [pendingGate.stageKey]: {
                            ...(i.stageData[pendingGate.stageKey] as
                              | ConceptData
                              | PrototypingData
                              | DistributionData
                              | undefined),
                            [pendingGate.field]: value,
                          },
                        },
                      }
                    : i,
                ),
              );
              setPendingGate(null);
            }
            return moveResult;
          }}
        />
      )}
    </div>
  );
}
