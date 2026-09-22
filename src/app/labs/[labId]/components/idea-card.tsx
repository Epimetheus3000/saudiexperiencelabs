"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toggleFavorite, deleteIdea } from "@/app/labs/[labId]/actions";
import type { IdeaWithExtras, CriterionMeta, StageMeta } from "@/app/labs/[labId]/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { IdeaDetailDialog } from "./idea-detail-dialog";

export function IdeaCard({
  idea,
  labId,
  stages,
  criteria,
  currentUserId,
  isMaster,
}: {
  idea: IdeaWithExtras;
  labId: string;
  stages: StageMeta[];
  criteria: CriterionMeta[];
  currentUserId: string;
  isMaster: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: idea.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 10 : undefined }
    : undefined;

  function onToggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await toggleFavorite(idea.id, labId, idea.favoritedByCurrentUser);
      if (!result.ok) toast.error(result.error);
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteIdea(idea.id, labId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Idea removed");
      router.refresh();
    });
  }

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={() => !isDragging && setOpen(true)}
        className={`relative cursor-grab touch-none py-3 active:cursor-grabbing ${
          isDragging ? "opacity-50 shadow-lg" : ""
        }`}
      >
        {idea.comments.length > 0 && (
          <span
            className="absolute top-2 right-2 size-2.5 rounded-full bg-red-500"
            title={`${idea.comments.length} comment${idea.comments.length === 1 ? "" : "s"}`}
            aria-label="Has comments"
          />
        )}
        <CardHeader className="px-3">
          <CardTitle className="pr-4 text-sm font-medium leading-snug">{idea.title}</CardTitle>
          <div className="flex items-center justify-between gap-2">
            {idea.category ? (
              <Badge variant="outline" className="w-fit text-xs">
                {idea.category}
              </Badge>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleFavorite}
                disabled={isPending}
                className="flex items-center gap-1 text-muted-foreground"
                title={idea.favoritedByCurrentUser ? "Remove favorite" : "Mark as favorite"}
              >
                <Star
                  className={`size-4 ${
                    idea.favoritedByCurrentUser
                      ? "fill-yellow-400 text-yellow-500"
                      : "fill-none text-muted-foreground"
                  }`}
                />
                {idea.favoriteCount > 0 && (
                  <span className="text-xs">{idea.favoriteCount}</span>
                )}
              </button>
              {isMaster && (
                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove idea"
                  >
                    <Trash2 className="size-3.5" />
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove &ldquo;{idea.title}&rdquo;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes the idea and everything attached to it —
                        comments, ratings, and stage details. This can&apos;t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <IdeaDetailDialog
        idea={idea}
        open={open}
        onOpenChange={setOpen}
        stages={stages}
        criteria={criteria}
        currentUserId={currentUserId}
        labId={labId}
      />
    </>
  );
}
