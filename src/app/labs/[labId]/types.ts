import type { ChecklistItem, StageData } from "./stage-data";

export type StageMeta = {
  id: string;
  name: string;
  position: number;
  description: string | null;
  gateChecklist: ChecklistItem[];
  deadlineAt: string | null;
};

export type CriterionMeta = {
  id: string;
  name: string;
  scale: number;
  labId: string | null;
};

export type CommentWithAuthor = {
  id: string;
  userId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
};

export type RatingEntry = {
  criterionId: string;
  userId: string;
  score: number;
};

export type RequirementEntry = {
  id: string;
  userId: string;
  authorEmail: string;
  body: string;
  done: boolean;
  createdAt: string;
};

export type IdeaWithExtras = {
  id: string;
  labId: string;
  stageId: string;
  title: string;
  category: string | null;
  description: string | null;
  pros: string | null;
  cons: string | null;
  stageData: StageData;
  createdByEmail: string | null;
  createdAt: string;
  ratings: RatingEntry[];
  comments: CommentWithAuthor[];
  favoritedByCurrentUser: boolean;
  favoriteCount: number;
  requirements: RequirementEntry[];
};
