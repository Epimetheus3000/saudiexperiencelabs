"use client";

import { formatDistanceToNow } from "date-fns";
import { Star, MessageCircle, Clock } from "lucide-react";
import type { IdeaWithExtras, StageMeta } from "@/app/labs/[labId]/types";
import { averageRating, isIdeaStale } from "@/app/labs/[labId]/idea-utils";
import { Badge } from "@/components/ui/badge";

// The same filtered/sorted idea list as the board, just laid out for
// scanning everything at once — bulk review, printing, or finding one idea
// among many is awkward in a multi-column board. Clicking a row opens the
// same IdeaDetailDialog the board uses.
export function IdeaListView({
  ideas,
  stages,
  onOpenIdea,
}: {
  ideas: IdeaWithExtras[];
  stages: StageMeta[];
  onOpenIdea: (ideaId: string) => void;
}) {
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));

  if (ideas.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        No ideas match the current filters.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-2 pb-2 font-medium">Title</th>
            <th className="px-2 pb-2 font-medium">Stage</th>
            <th className="px-2 pb-2 font-medium">Category</th>
            <th className="px-2 pb-2 font-medium">Favorites</th>
            <th className="px-2 pb-2 font-medium">Comments</th>
            <th className="px-2 pb-2 font-medium">Rating</th>
            <th className="px-2 pb-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {ideas.map((idea) => {
            const rating = averageRating(idea);
            return (
              <tr
                key={idea.id}
                onClick={() => onOpenIdea(idea.id)}
                className="cursor-pointer border-b hover:bg-muted/50"
              >
                <td className="px-2 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    {idea.title}
                    {isIdeaStale(idea) && (
                      <Clock className="size-3.5 shrink-0 text-amber-600" aria-label="Stale" />
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-muted-foreground">
                  {stageNameById.get(idea.stageId) ?? "—"}
                </td>
                <td className="px-2 py-2">
                  {idea.category ? (
                    <Badge variant="outline" className="text-xs">
                      {idea.category}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Star
                      className={`size-3.5 ${idea.favoriteCount > 0 ? "fill-yellow-400 text-yellow-500" : ""}`}
                    />
                    {idea.favoriteCount}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MessageCircle className="size-3.5" />
                    {idea.comments.length}
                  </div>
                </td>
                <td className="px-2 py-2 text-muted-foreground">{rating ? rating.toFixed(1) : "—"}</td>
                <td className="px-2 py-2 text-muted-foreground">
                  {formatDistanceToNow(new Date(idea.updatedAt), { addSuffix: true })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
