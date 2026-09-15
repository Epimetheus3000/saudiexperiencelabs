"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { updateConceptFields, upsertRating, addComment } from "@/app/labs/[labId]/actions";
import type { IdeaWithExtras, CriterionMeta } from "@/app/labs/[labId]/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
        selected
          ? "border-transparent bg-[var(--lab-primary)] text-white"
          : "hover:bg-muted"
      }`}
    >
      {score}
    </button>
  );
}

function CriterionRating({
  ideaId,
  labId,
  criterion,
  currentUserId,
  ratings,
}: {
  ideaId: string;
  labId: string;
  criterion: CriterionMeta;
  currentUserId: string;
  ratings: IdeaWithExtras["ratings"];
}) {
  const [isPending, startTransition] = useTransition();
  const myRating = ratings.find(
    (r) => r.criterionId === criterion.id && r.userId === currentUserId,
  );
  const others = ratings.filter((r) => r.criterionId === criterion.id);
  const average =
    others.length > 0 ? (others.reduce((sum, r) => sum + r.score, 0) / others.length).toFixed(1) : null;

  function onSelect(score: number) {
    startTransition(async () => {
      const result = await upsertRating(ideaId, labId, criterion.id, score);
      if (!result.ok) toast.error(result.error);
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
      <div className={`flex gap-1 ${isPending ? "opacity-60" : ""}`}>
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

function ConceptFieldsForm({ idea, labId }: { idea: IdeaWithExtras; labId: string }) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateConceptFields(idea.id, labId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Concept details saved");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="concept_details">Experience details</Label>
        <Textarea
          id="concept_details"
          name="concept_details"
          defaultValue={idea.conceptDetails ?? ""}
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="concept_audience">Audience</Label>
        <Textarea
          id="concept_audience"
          name="concept_audience"
          defaultValue={idea.conceptAudience ?? ""}
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="concept_notes">Notes</Label>
        <Textarea
          id="concept_notes"
          name="concept_notes"
          defaultValue={idea.conceptNotes ?? ""}
          rows={2}
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Save concept details"}
      </Button>
    </form>
  );
}

function CommentsSection({ idea, labId }: { idea: IdeaWithExtras; labId: string }) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addComment(idea.id, labId, body);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBody("");
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
        <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
          Post
        </Button>
      </form>
    </div>
  );
}

export function IdeaDetailDialog({
  idea,
  open,
  onOpenChange,
  isAtLeastConcept,
  isAtLeastShortlist,
  criteria,
  currentUserId,
  labId,
}: {
  idea: IdeaWithExtras;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAtLeastConcept: boolean;
  isAtLeastShortlist: boolean;
  criteria: CriterionMeta[];
  currentUserId: string;
  labId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{idea.title}</DialogTitle>
          <DialogDescription>
            {idea.category && <Badge variant="outline">{idea.category}</Badge>}
            {idea.createdByEmail && <span className="ml-2">Added by {idea.createdByEmail}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {idea.description && (
            <div>
              <p className="text-sm font-medium">Description</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {idea.description}
              </p>
            </div>
          )}

          {(idea.pros || idea.cons) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Pros</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {idea.pros || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Cons</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {idea.cons || "—"}
                </p>
              </div>
            </div>
          )}

          {isAtLeastShortlist && idea.shortlistReasoning && (
            <div>
              <p className="text-sm font-medium">Shortlist reasoning</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {idea.shortlistReasoning}
              </p>
            </div>
          )}

          {isAtLeastConcept && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Concept</p>
                <ConceptFieldsForm idea={idea} labId={labId} />
              </div>

              <Separator />
              <div>
                <p className="mb-1 text-sm font-medium">Ratings</p>
                <div className="divide-y">
                  {criteria.map((c) => (
                    <CriterionRating
                      key={c.id}
                      ideaId={idea.id}
                      labId={labId}
                      criterion={c}
                      currentUserId={currentUserId}
                      ratings={idea.ratings}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div>
            <p className="mb-2 text-sm font-medium">Comments</p>
            <CommentsSection idea={idea} labId={labId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
