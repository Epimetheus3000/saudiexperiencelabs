"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Star } from "lucide-react";
import {
  updateStageData,
  upsertRating,
  addComment,
  addRequirement,
  toggleRequirement,
  removeRequirement,
} from "@/app/labs/[labId]/actions";
import type { IdeaWithExtras, CriterionMeta, StageMeta } from "@/app/labs/[labId]/types";
import type { ChecklistItem, TodoItem } from "@/app/labs/[labId]/stage-data";
import { DISTRIBUTION_CHANNELS } from "@/app/labs/[labId]/stage-data";
import { VisualsUploader } from "./visuals-uploader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type IdeaUpdater = (ideaId: string, patch: Partial<IdeaWithExtras>) => void;

function ScoreButton({
  score,
  selected,
  onSelect,
}: {
  score: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
        selected ? "border-transparent bg-[var(--lab-primary)] text-white" : "hover:bg-muted"
      }`}
    >
      {score}
    </button>
  );
}

function CriterionRating({
  idea,
  labId,
  criterion,
  currentUserId,
  onIdeaUpdate,
}: {
  idea: IdeaWithExtras;
  labId: string;
  criterion: CriterionMeta;
  currentUserId: string;
  onIdeaUpdate: IdeaUpdater;
}) {
  const router = useRouter();
  const ratings = idea.ratings;
  const myRating = ratings.find(
    (r) => r.criterionId === criterion.id && r.userId === currentUserId,
  );
  const others = ratings.filter((r) => r.criterionId === criterion.id);
  const average =
    others.length > 0 ? (others.reduce((sum, r) => sum + r.score, 0) / others.length).toFixed(1) : null;

  function onSelect(score: number) {
    const nextRatings = [
      ...ratings.filter((r) => !(r.criterionId === criterion.id && r.userId === currentUserId)),
      { criterionId: criterion.id, userId: currentUserId, score },
    ];
    onIdeaUpdate(idea.id, { ratings: nextRatings });
    upsertRating(idea.id, labId, criterion.id, score).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{criterion.name}</p>
        {average && (
          <p className="text-xs text-muted-foreground">
            Avg {average} across {others.length} rating{others.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: criterion.scale }, (_, i) => i + 1).map((score) => (
          <ScoreButton
            key={score}
            score={score}
            selected={myRating?.score === score}
            onSelect={() => onSelect(score)}
          />
        ))}
      </div>
    </div>
  );
}

function ChecklistSection({
  idea,
  labId,
  stageKey,
  items,
  onIdeaUpdate,
}: {
  idea: IdeaWithExtras;
  labId: string;
  stageKey: "shortlist" | "goLive";
  items: ChecklistItem[];
  onIdeaUpdate: IdeaUpdater;
}) {
  const router = useRouter();
  const checked = idea.stageData[stageKey]?.checklist ?? {};

  function onToggle(key: string, value: boolean) {
    const nextChecklist = { ...checked, [key]: value };
    onIdeaUpdate(idea.id, {
      stageData: { ...idea.stageData, [stageKey]: { ...idea.stageData[stageKey], checklist: nextChecklist } },
    });
    updateStageData(idea.id, labId, stageKey, { checklist: nextChecklist }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <label key={item.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked[item.key] ?? false}
            onChange={(e) => onToggle(item.key, e.target.checked)}
          />
          {item.label}
        </label>
      ))}
      <p className="text-xs text-muted-foreground">Tracked for visibility — doesn&apos;t block moving forward.</p>
    </div>
  );
}

function ShortlistSection({
  idea,
  labId,
  stage,
  onIdeaUpdate,
}: {
  idea: IdeaWithExtras;
  labId: string;
  stage: StageMeta;
  onIdeaUpdate: IdeaUpdater;
}) {
  const [reasoning, setReasoning] = useState(idea.stageData.shortlist?.reasoning ?? "");
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  function onSave() {
    setIsPending(true);
    onIdeaUpdate(idea.id, {
      stageData: { ...idea.stageData, shortlist: { ...idea.stageData.shortlist, reasoning } },
    });
    toast.success("Reasoning saved");
    updateStageData(idea.id, labId, "shortlist", { reasoning }).then((result) => {
      setIsPending(false);
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="reasoning">Reasoning for shortlisting</Label>
        <Textarea id="reasoning" rows={3} value={reasoning} onChange={(e) => setReasoning(e.target.value)} />
        <Button size="sm" disabled={isPending} onClick={onSave}>
          Save reasoning
        </Button>
      </div>
      <ChecklistSection
        idea={idea}
        labId={labId}
        stageKey="shortlist"
        items={stage.gateChecklist}
        onIdeaUpdate={onIdeaUpdate}
      />
    </div>
  );
}

function ConceptSection({
  idea,
  labId,
  criteria,
  currentUserId,
  onIdeaUpdate,
}: {
  idea: IdeaWithExtras;
  labId: string;
  criteria: CriterionMeta[];
  currentUserId: string;
  onIdeaUpdate: IdeaUpdater;
}) {
  const router = useRouter();
  const concept = idea.stageData.concept ?? {};

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const patch = {
      place: (formData.get("place") as string) || null,
      story: (formData.get("story") as string) || null,
      operationalDetails: (formData.get("operationalDetails") as string) || null,
      audience: (formData.get("audience") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };
    onIdeaUpdate(idea.id, { stageData: { ...idea.stageData, concept: { ...concept, ...patch } } });
    toast.success("Concept saved");
    updateStageData(idea.id, labId, "concept", patch).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="place">Place</Label>
          <Textarea id="place" name="place" defaultValue={concept.place ?? ""} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="story">Story</Label>
          <Textarea id="story" name="story" defaultValue={concept.story ?? ""} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="operationalDetails">Operational details</Label>
          <Textarea
            id="operationalDetails"
            name="operationalDetails"
            defaultValue={concept.operationalDetails ?? ""}
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audience">Audience</Label>
          <Textarea id="audience" name="audience" defaultValue={concept.audience ?? ""} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" defaultValue={concept.notes ?? ""} rows={2} />
        </div>
        <Button type="submit" size="sm">
          Save concept
        </Button>
      </form>

      <div className="space-y-1.5">
        <Label>Visuals</Label>
        <VisualsUploader
          ideaId={idea.id}
          labId={labId}
          visuals={concept.visuals ?? []}
          currentUserId={currentUserId}
          stageData={idea.stageData}
          onIdeaUpdate={onIdeaUpdate}
        />
      </div>

      <Separator />
      <div>
        <p className="mb-1 text-sm font-medium">Ratings</p>
        <div className="divide-y">
          {criteria.map((c) => (
            <CriterionRating
              key={c.id}
              idea={idea}
              labId={labId}
              criterion={c}
              currentUserId={currentUserId}
              onIdeaUpdate={onIdeaUpdate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PrototypingSection({
  idea,
  labId,
  onIdeaUpdate,
}: {
  idea: IdeaWithExtras;
  labId: string;
  onIdeaUpdate: IdeaUpdater;
}) {
  const router = useRouter();
  const prototyping = idea.stageData.prototyping ?? {};

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const patch = {
      testDate: (formData.get("testDate") as string) || null,
      audienceTested: (formData.get("audienceTested") as string) || null,
      mvpDescription: (formData.get("mvpDescription") as string) || null,
      results: (formData.get("results") as string) || null,
    };
    onIdeaUpdate(idea.id, {
      stageData: { ...idea.stageData, prototyping: { ...prototyping, ...patch } },
    });
    toast.success("Prototyping details saved");
    updateStageData(idea.id, labId, "prototyping", patch).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="testDate">Test date</Label>
        <Input id="testDate" name="testDate" type="date" defaultValue={prototyping.testDate ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audienceTested">Audience tested with</Label>
        <Textarea
          id="audienceTested"
          name="audienceTested"
          defaultValue={prototyping.audienceTested ?? ""}
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mvpDescription">MVP description</Label>
        <Textarea
          id="mvpDescription"
          name="mvpDescription"
          defaultValue={prototyping.mvpDescription ?? ""}
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="results">Results</Label>
        <Textarea id="results" name="results" defaultValue={prototyping.results ?? ""} rows={3} />
      </div>
      <Button type="submit" size="sm">
        Save
      </Button>
    </form>
  );
}

function DistributionSection({
  idea,
  labId,
  onIdeaUpdate,
}: {
  idea: IdeaWithExtras;
  labId: string;
  onIdeaUpdate: IdeaUpdater;
}) {
  const router = useRouter();
  const distribution = idea.stageData.distribution ?? {};
  const [todoText, setTodoText] = useState("");

  function persist(patch: Record<string, unknown>) {
    updateStageData(idea.id, labId, "distribution", patch).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  function onToggleChannel(key: string, on: boolean) {
    const current = distribution.channels ?? [];
    const channels = on ? [...current, key] : current.filter((c) => c !== key);
    onIdeaUpdate(idea.id, {
      stageData: { ...idea.stageData, distribution: { ...distribution, channels } },
    });
    persist({ channels });
  }

  function onSaveRequirements(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const requirements = (formData.get("requirements") as string) || null;
    onIdeaUpdate(idea.id, {
      stageData: { ...idea.stageData, distribution: { ...distribution, requirements } },
    });
    persist({ requirements });
  }

  function saveTodo(todo: TodoItem[]) {
    onIdeaUpdate(idea.id, { stageData: { ...idea.stageData, distribution: { ...distribution, todo } } });
    persist({ todo });
  }

  function onAddTodo() {
    if (!todoText.trim()) return;
    const todo = [...(distribution.todo ?? []), { id: crypto.randomUUID(), text: todoText.trim(), done: false }];
    saveTodo(todo);
    setTodoText("");
  }

  function onToggleTodo(id: string, done: boolean) {
    saveTodo((distribution.todo ?? []).map((t) => (t.id === id ? { ...t, done } : t)));
  }

  function onRemoveTodo(id: string) {
    saveTodo((distribution.todo ?? []).filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Channels</Label>
        <div className="space-y-1.5">
          {DISTRIBUTION_CHANNELS.map((ch) => (
            <label key={ch.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(distribution.channels ?? []).includes(ch.key)}
                onChange={(e) => onToggleChannel(ch.key, e.target.checked)}
              />
              {ch.label}
            </label>
          ))}
        </div>
      </div>

      <form onSubmit={onSaveRequirements} className="space-y-1.5">
        <Label htmlFor="requirements">Requirements</Label>
        <Textarea id="requirements" name="requirements" defaultValue={distribution.requirements ?? ""} rows={2} />
        <Button type="submit" size="sm">
          Save requirements
        </Button>
      </form>

      <div className="space-y-1.5">
        <Label>Todo list</Label>
        <div className="space-y-1">
          {(distribution.todo ?? []).map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={t.done} onChange={(e) => onToggleTodo(t.id, e.target.checked)} />
              <span className={t.done ? "flex-1 line-through text-muted-foreground" : "flex-1"}>{t.text}</span>
              <button type="button" onClick={() => onRemoveTodo(t.id)} className="text-xs text-muted-foreground hover:text-destructive">
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            placeholder="Add a task…"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddTodo())}
          />
          <Button type="button" size="sm" variant="outline" onClick={onAddTodo}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentsSection({
  idea,
  labId,
  currentUserId,
  currentUserEmail,
  onIdeaUpdate,
}: {
  idea: IdeaWithExtras;
  labId: string;
  currentUserId: string;
  currentUserEmail: string;
  onIdeaUpdate: IdeaUpdater;
}) {
  const [body, setBody] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    onIdeaUpdate(idea.id, {
      comments: [
        ...idea.comments,
        {
          id: crypto.randomUUID(),
          userId: currentUserId,
          authorEmail: currentUserEmail,
          body: trimmed,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setBody("");
    addComment(idea.id, labId, trimmed).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="max-h-48 space-y-3 overflow-y-auto">
        {idea.comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {idea.comments.map((c) => (
          <div key={c.id} className="text-sm">
            <span className="font-medium">{c.authorEmail}</span>{" "}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
            </span>
            <p>{c.body}</p>
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!body.trim()}>
          Post
        </Button>
      </form>
    </div>
  );
}

// A keyboard/screen-reader accessible alternative to dragging the card
// between columns — dnd-kit's pointer-only sensor here means drag is the
// only way to move a card otherwise. Reuses the exact same move logic
// (reasoning/gate checks included) as a drag-and-drop drop.
function MoveToStage({
  idea,
  stages,
  onRequestMove,
}: {
  idea: IdeaWithExtras;
  stages: StageMeta[];
  onRequestMove: (ideaId: string, targetStageId: string) => void;
}) {
  return (
    <Select value={idea.stageId} onValueChange={(value) => value && onRequestMove(idea.id, value)}>
      <SelectTrigger size="sm" className="w-auto" aria-label="Move to stage">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stages
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              {stage.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function FavoriteToggle({
  ideaId,
  favorited,
  count,
  onToggleFavorite,
}: {
  ideaId: string;
  favorited: boolean;
  count: number;
  onToggleFavorite: (ideaId: string, currentlyFavorited: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggleFavorite(ideaId, favorited)}
      className="flex items-center gap-1 text-muted-foreground"
      title={favorited ? "Remove favorite" : "Mark as favorite"}
    >
      <Star
        className={`size-5 ${
          favorited ? "fill-yellow-400 text-yellow-500" : "fill-none text-muted-foreground"
        }`}
      />
      {count > 0 && <span className="text-sm">{count}</span>}
    </button>
  );
}

// Per-user "what this idea needs to move forward" notes — distinct from the
// Distribution stage's shared todo list (stage_data JSON), this one is
// attributed per author and available at every stage.
function RequirementsSection({
  idea,
  labId,
  currentUserId,
  currentUserEmail,
  onIdeaUpdate,
}: {
  idea: IdeaWithExtras;
  labId: string;
  currentUserId: string;
  currentUserEmail: string;
  onIdeaUpdate: IdeaUpdater;
}) {
  const [body, setBody] = useState("");
  const router = useRouter();

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    onIdeaUpdate(idea.id, {
      requirements: [
        ...idea.requirements,
        {
          id: crypto.randomUUID(),
          userId: currentUserId,
          authorEmail: currentUserEmail,
          body: trimmed,
          done: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setBody("");
    addRequirement(idea.id, labId, trimmed).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  function onToggle(requirementId: string, done: boolean) {
    onIdeaUpdate(idea.id, {
      requirements: idea.requirements.map((r) => (r.id === requirementId ? { ...r, done } : r)),
    });
    toggleRequirement(requirementId, labId, done).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  function onRemove(requirementId: string) {
    onIdeaUpdate(idea.id, {
      requirements: idea.requirements.filter((r) => r.id !== requirementId),
    });
    removeRequirement(requirementId, labId).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {idea.requirements.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing added yet.</p>
        )}
        {idea.requirements.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={r.done}
              onChange={(e) => onToggle(r.id, e.target.checked)}
            />
            <span className={r.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>
              {r.body}
            </span>
            <span className="text-xs text-muted-foreground">{r.authorEmail}</span>
            {(r.userId === currentUserId) && (
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={onAdd} className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What does this idea need to move forward?"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!body.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

export function IdeaDetailDialog({
  idea,
  open,
  onOpenChange,
  stages,
  criteria,
  currentUserId,
  currentUserEmail,
  labId,
  onToggleFavorite,
  onIdeaUpdate,
  onRequestMove,
}: {
  idea: IdeaWithExtras;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: StageMeta[];
  criteria: CriterionMeta[];
  currentUserId: string;
  currentUserEmail: string;
  labId: string;
  onToggleFavorite: (ideaId: string, currentlyFavorited: boolean) => void;
  onIdeaUpdate: IdeaUpdater;
  onRequestMove: (ideaId: string, targetStageId: string) => void;
}) {
  const currentStage = stages.find((s) => s.id === idea.stageId);
  const currentPosition = currentStage?.position ?? 0;
  const positionOf = (name: string) => stages.find((s) => s.name === name)?.position ?? Infinity;

  const atLeastShortlist = currentPosition >= positionOf("Shortlist");
  const atLeastConcept = currentPosition >= positionOf("Concept");
  const atLeastPrototyping = currentPosition >= positionOf("Prototyping / Field-Testing");
  const atLeastGoLive = currentPosition >= positionOf("Go-Live");
  const atLeastDistribution = currentPosition >= positionOf("Distribution");

  const shortlistStage = stages.find((s) => s.name === "Shortlist");
  const goLiveStage = stages.find((s) => s.name === "Go-Live");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle>{idea.title}</DialogTitle>
            <FavoriteToggle
              ideaId={idea.id}
              favorited={idea.favoritedByCurrentUser}
              count={idea.favoriteCount}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Stage:</span>
            <MoveToStage idea={idea} stages={stages} onRequestMove={onRequestMove} />
          </div>
          <DialogDescription>
            {idea.category && <Badge variant="outline">{idea.category}</Badge>}
            {idea.createdByEmail && <span className="ml-2">Added by {idea.createdByEmail}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {idea.description && (
            <div>
              <p className="text-sm font-medium">Description</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{idea.description}</p>
            </div>
          )}

          {(idea.pros || idea.cons) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Pros</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{idea.pros || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Cons</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{idea.cons || "—"}</p>
              </div>
            </div>
          )}

          {atLeastShortlist && shortlistStage && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Shortlist</p>
                <ShortlistSection idea={idea} labId={labId} stage={shortlistStage} onIdeaUpdate={onIdeaUpdate} />
              </div>
            </>
          )}

          {atLeastConcept && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Concept</p>
                <ConceptSection
                  idea={idea}
                  labId={labId}
                  criteria={criteria}
                  currentUserId={currentUserId}
                  onIdeaUpdate={onIdeaUpdate}
                />
              </div>
            </>
          )}

          {atLeastPrototyping && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Prototyping / Field-Testing</p>
                <PrototypingSection idea={idea} labId={labId} onIdeaUpdate={onIdeaUpdate} />
              </div>
            </>
          )}

          {atLeastGoLive && goLiveStage && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Go-Live checklist</p>
                <ChecklistSection
                  idea={idea}
                  labId={labId}
                  stageKey="goLive"
                  items={goLiveStage.gateChecklist}
                  onIdeaUpdate={onIdeaUpdate}
                />
              </div>
            </>
          )}

          {atLeastDistribution && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Distribution</p>
                <DistributionSection idea={idea} labId={labId} onIdeaUpdate={onIdeaUpdate} />
              </div>
            </>
          )}

          <Separator />
          <div>
            <p className="mb-2 text-sm font-medium">What this idea needs to move forward</p>
            <RequirementsSection
              idea={idea}
              labId={labId}
              currentUserId={currentUserId}
              currentUserEmail={currentUserEmail}
              onIdeaUpdate={onIdeaUpdate}
            />
          </div>

          <Separator />
          <div>
            <p className="mb-2 text-sm font-medium">Comments</p>
            <CommentsSection
              idea={idea}
              labId={labId}
              currentUserId={currentUserId}
              currentUserEmail={currentUserEmail}
              onIdeaUpdate={onIdeaUpdate}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
