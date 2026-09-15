"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { IdeaWithExtras, CriterionMeta } from "@/app/labs/[labId]/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IdeaDetailDialog } from "./idea-detail-dialog";

export function IdeaCard({
  idea,
  labId,
  isAtLeastConcept,
  isAtLeastShortlist,
  criteria,
  currentUserId,
}: {
  idea: IdeaWithExtras;
  labId: string;
  isAtLeastConcept: boolean;
  isAtLeastShortlist: boolean;
  criteria: CriterionMeta[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: idea.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 10 : undefined }
    : undefined;

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={() => !isDragging && setOpen(true)}
        className={`cursor-grab touch-none py-3 active:cursor-grabbing ${
          isDragging ? "opacity-50 shadow-lg" : ""
        }`}
      >
        <CardHeader className="px-3">
          <CardTitle className="text-sm font-medium leading-snug">{idea.title}</CardTitle>
          {idea.category && (
            <Badge variant="outline" className="w-fit text-xs">
              {idea.category}
            </Badge>
          )}
        </CardHeader>
      </Card>

      <IdeaDetailDialog
        idea={idea}
        open={open}
        onOpenChange={setOpen}
        isAtLeastConcept={isAtLeastConcept}
        isAtLeastShortlist={isAtLeastShortlist}
        criteria={criteria}
        currentUserId={currentUserId}
        labId={labId}
      />
    </>
  );
}
