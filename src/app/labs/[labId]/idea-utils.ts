import type { IdeaWithExtras } from "./types";

export const STALE_DAYS = 14;

export function averageRating(idea: IdeaWithExtras) {
  if (idea.ratings.length === 0) return 0;
  return idea.ratings.reduce((sum, r) => sum + r.score, 0) / idea.ratings.length;
}

// A rough "is anyone touching this" signal for surfacing ideas that have
// stalled — deliberately simple (one field, one threshold) rather than
// trying to weigh every activity type.
export function isIdeaStale(idea: IdeaWithExtras) {
  const daysSinceUpdate = (Date.now() - new Date(idea.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate >= STALE_DAYS;
}
