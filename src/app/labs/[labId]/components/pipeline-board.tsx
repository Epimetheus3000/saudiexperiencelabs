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
import { moveIdea, updateStageData, toggleFavorite, createIdea, deleteIdea } from "@/app/labs/[labId]/actions";
import type { IdeaWithExtras, StageMeta, CriterionMeta } from "@/app/labs/[labId]/types";
import { averageRating } from "@/app/labs/[labId]/idea-utils";
import { IdeaCard } from "./idea-card";
import { IdeaListView } from "./idea-list-view";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { IdeaDetailDialog } from "./idea-detail-dialog";
import { ReasoningDialog } from "./reasoning-dialog";
import { StageGateDialog, type GateField } from "./stage-gate-dialog";
import { Countdown } from "@/components/countdown";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Star, LayoutGrid, List as ListIcon } from "lucide-react";

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

type SortOption = "added" | "newest" | "favorites" | "rating";

function sortIdeas(list: IdeaWithExtras[], sortBy: SortOption) {
  if (sortBy === "added") return list;
  const sorted = [...list];
  if (sortBy === "favorites") sorted.sort((a, b) => b.favoriteCount - a.favoriteCount);
  else if (sortBy === "rating") sorted.sort((a, b) => averageRating(b) - averageRating(a));
  else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return sorted;
}

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

// Fixed brand purple rather than the lab's own accent color (inherited via
// --strip-color from the layout) — a solid brand-guideline color that reads
// as "Saudi Experience Labs" chrome, distinct from whatever accent this
// particular lab picked. --brand-purple-dark is never offered as a lab
// accent option (see BRAND_ACCENTS in brand-color-picker.tsx), so it can't
// collide with a lab's own color.
function ColumnBand() {
  return (
    <div
      className="pattern-strip h-1.5 w-72 shrink-0"
      style={{ "--strip-color": "var(--brand-purple-dark)" } as React.CSSProperties}
      aria-hidden
    />
  );
}

function ColumnBody({
  stage,
  ideas,
  labId,
  stages,
  criteria,
  currentUserId,
  currentUserEmail,
  isMaster,
  categories,
  onToggleFavorite,
  onDeleteIdea,
  onCreateIdea,
  onIdeaUpdate,
  onRequestMove,
}: {
  stage: StageMeta;
  ideas: IdeaWithExtras[];
  labId: string;
  stages: StageMeta[];
  criteria: CriterionMeta[];
  currentUserId: string;
  currentUserEmail: string;
  isMaster: boolean;
  categories: string[];
  onToggleFavorite: (ideaId: string, currentlyFavorited: boolean) => void;
  onDeleteIdea: (ideaId: string) => void;
  onCreateIdea: (tempIdea: IdeaWithExtras, formData: FormData) => void;
  onIdeaUpdate: (ideaId: string, patch: Partial<IdeaWithExtras>) => void;
  onRequestMove: (ideaId: string, targetStageId: string) => void;
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
        <CreateIdeaDialog
          labId={labId}
          stageId={stage.id}
          longlistCount={ideas.length}
          categories={categories}
          currentUserEmail={currentUserEmail}
          onCreateIdea={onCreateIdea}
        />
      )}
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          labId={labId}
          stages={stages}
          criteria={criteria}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
          isMaster={isMaster}
          onToggleFavorite={onToggleFavorite}
          onDeleteIdea={onDeleteIdea}
          onIdeaUpdate={onIdeaUpdate}
          onRequestMove={onRequestMove}
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
  currentUserEmail,
  isMaster,
  categories,
}: {
  labId: string;
  stages: StageMeta[];
  ideas: IdeaWithExtras[];
  criteria: CriterionMeta[];
  currentUserId: string;
  currentUserEmail: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("added");
  const [view, setView] = useState<"board" | "list">("board");
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
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

  // Client-side, since every idea is already loaded — filtering/sorting
  // this way is instant, no round-trip needed.
  const visibleIdeas = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = localIdeas.filter((idea) => {
      if (favoritesOnly && !idea.favoritedByCurrentUser) return false;
      if (categoryFilter !== "all" && idea.category !== categoryFilter) return false;
      if (query) {
        const haystack = `${idea.title} ${idea.description ?? ""} ${idea.category ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    return sortIdeas(filtered, sortBy);
  }, [localIdeas, searchQuery, categoryFilter, favoritesOnly, sortBy]);

  const ideasByStage = useMemo(() => {
    const map = new Map<string, IdeaWithExtras[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const idea of visibleIdeas) {
      map.get(idea.stageId)?.push(idea);
    }
    return map;
  }, [visibleIdeas, stages]);

  const selectedIdea = localIdeas.find((i) => i.id === selectedIdeaId) ?? null;

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
              updatedAt: new Date().toISOString(),
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

  // Generic optimistic patch, used by every mutation inside the idea detail
  // dialog (ratings, checklists, stage-data forms, comments, requirements).
  // Each caller computes its own next-state shape and applies it here
  // immediately; on a save failure the caller falls back to router.refresh()
  // to resync from the server rather than hand-writing a revert for every
  // field shape.
  function applyIdeaPatch(ideaId: string, patch: Partial<IdeaWithExtras>) {
    setLocalIdeas((prev) => prev.map((i) => (i.id === ideaId ? { ...i, ...patch } : i)));
  }

  function commitDeleteIdea(ideaId: string) {
    const previous = localIdeas;
    setLocalIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    deleteIdea(ideaId, labId).then((result) => {
      if (!result.ok) {
        setLocalIdeas(previous);
        toast.error(result.error);
        return;
      }
      toast.success("Idea removed");
    });
  }

  function commitCreateIdea(tempIdea: IdeaWithExtras, formData: FormData) {
    setLocalIdeas((prev) => [...prev, tempIdea]);
    createIdea(labId, formData).then((result) => {
      if (!result.ok) {
        setLocalIdeas((prev) => prev.filter((i) => i.id !== tempIdea.id));
        toast.error(result.error);
        return;
      }
      // Reconcile the client-generated temp id with the real one — the
      // window where they differ is just this round-trip.
      setLocalIdeas((prev) =>
        prev.map((i) =>
          i.id === tempIdea.id ? { ...i, id: result.idea.id, createdAt: result.idea.createdAt } : i,
        ),
      );
    });
  }

  // Shared by drag-and-drop and the "Move to stage" dropdown in the idea
  // dialog — the same reasoning/gate checks apply no matter how the move
  // was requested, so this only needs to exist once.
  function requestMove(ideaId: string, targetStageId: string) {
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

  function onDragEnd(event: DragEndEvent) {
    setActiveIdeaId(null);
    const { active, over } = event;
    if (!over) return;
    requestMove(String(active.id), String(over.id));
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ideas…"
            className="w-56 pl-7"
          />
        </div>

        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          type="button"
          variant={favoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFavoritesOnly((v) => !v)}
          className="gap-1.5"
        >
          <Star className={`size-3.5 ${favoritesOnly ? "fill-white" : ""}`} />
          Favorites
        </Button>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="added">Order added</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="favorites">Most favorited</SelectItem>
            <SelectItem value="rating">Highest rated</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "board" ? "secondary" : "ghost"}
            onClick={() => setView("board")}
            className="gap-1.5"
          >
            <LayoutGrid className="size-3.5" />
            Board
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            onClick={() => setView("list")}
            className="gap-1.5"
          >
            <ListIcon className="size-3.5" />
            List
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <IdeaListView ideas={visibleIdeas} stages={stages} onOpenIdea={setSelectedIdeaId} />
      ) : (
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
              currentUserEmail={currentUserEmail}
              isMaster={isMaster}
              categories={categories}
              onToggleFavorite={commitToggleFavorite}
              onDeleteIdea={commitDeleteIdea}
              onCreateIdea={commitCreateIdea}
              onIdeaUpdate={applyIdeaPatch}
              onRequestMove={requestMove}
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
      )}

      {selectedIdea && (
        <IdeaDetailDialog
          key={selectedIdea.id}
          idea={selectedIdea}
          open
          onOpenChange={(next) => !next && setSelectedIdeaId(null)}
          stages={stages}
          criteria={criteria}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
          labId={labId}
          onToggleFavorite={commitToggleFavorite}
          onIdeaUpdate={applyIdeaPatch}
          onRequestMove={requestMove}
        />
      )}

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
