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
import { toast } from "sonner";
import { moveIdea } from "@/app/labs/[labId]/actions";
import type { IdeaWithExtras, StageMeta, CriterionMeta } from "@/app/labs/[labId]/types";
import { IdeaCard } from "./idea-card";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { ReasoningDialog } from "./reasoning-dialog";
import { Countdown } from "@/components/countdown";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Column({
  stage,
  ideas,
  labId,
  criteria,
  currentUserId,
  shortlistPosition,
  conceptPosition,
}: {
  stage: StageMeta;
  ideas: IdeaWithExtras[];
  labId: string;
  criteria: CriterionMeta[];
  currentUserId: string;
  shortlistPosition: number;
  conceptPosition: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 ${
        isOver ? "ring-2 ring-[var(--lab-primary)]" : ""
      }`}
    >
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{stage.name}</h3>
          <Badge variant="secondary">{ideas.length}</Badge>
        </div>
        {stage.deadlineAt && (
          <p className="text-xs">
            <Countdown deadlineAt={stage.deadlineAt} />
          </p>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            labId={labId}
            criteria={criteria}
            currentUserId={currentUserId}
            isAtLeastShortlist={stage.position >= shortlistPosition}
            isAtLeastConcept={stage.position >= conceptPosition}
          />
        ))}
        {ideas.length === 0 && (
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
}: {
  labId: string;
  stages: StageMeta[];
  ideas: IdeaWithExtras[];
  criteria: CriterionMeta[];
  currentUserId: string;
}) {
  const [localIdeas, setLocalIdeas] = useState(ideas);
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    ideaId: string;
    ideaTitle: string;
    targetStageId: string;
    targetStageName: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const longlistStage = stages.find((s) => s.name === "Longlist");
  const shortlistStage = stages.find((s) => s.name === "Shortlist");
  const conceptStage = stages.find((s) => s.name === "Concept");

  const ideasByStage = useMemo(() => {
    const map = new Map<string, IdeaWithExtras[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const idea of localIdeas) {
      map.get(idea.stageId)?.push(idea);
    }
    return map;
  }, [localIdeas, stages]);

  const longlistCount = longlistStage ? (ideasByStage.get(longlistStage.id)?.length ?? 0) : 0;
  const activeIdea = localIdeas.find((i) => i.id === activeIdeaId) ?? null;

  function onDragStart(event: DragStartEvent) {
    setActiveIdeaId(String(event.active.id));
  }

  async function commitMove(ideaId: string, targetStageId: string, reasoning?: string) {
    const result = await moveIdea(ideaId, labId, targetStageId, reasoning);
    if (result.ok) {
      setLocalIdeas((prev) =>
        prev.map((i) =>
          i.id === ideaId
            ? { ...i, stageId: targetStageId, shortlistReasoning: reasoning ?? i.shortlistReasoning }
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
      !idea.shortlistReasoning;

    if (needsReasoning) {
      setPendingMove({
        ideaId,
        ideaTitle: idea.title,
        targetStageId,
        targetStageName: targetStage.name,
      });
      return;
    }

    commitMove(ideaId, targetStageId).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Longlist: {longlistCount}/50
        </p>
        <CreateIdeaDialog labId={labId} longlistCount={longlistCount} />
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              ideas={ideasByStage.get(stage.id) ?? []}
              labId={labId}
              criteria={criteria}
              currentUserId={currentUserId}
              shortlistPosition={shortlistStage?.position ?? Infinity}
              conceptPosition={conceptStage?.position ?? Infinity}
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
          onCancel={() => setPendingMove(null)}
          onConfirm={async (reasoning) => {
            const result = await commitMove(pendingMove.ideaId, pendingMove.targetStageId, reasoning);
            if (result.ok) setPendingMove(null);
            return result;
          }}
        />
      )}
    </div>
  );
}
