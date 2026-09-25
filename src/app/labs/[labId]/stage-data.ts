// Shared constants for how ideas.stage_data is keyed and shaped. Keyed by
// stage *name* rather than stage id — matches how the DB triggers already
// identify stages (name is load-bearing there too), and reads far better in
// the database than a UUID would. A Master rename of a default stage would
// orphan existing data under the old key; there's no rename UI today, so
// this is an accepted tradeoff, not an oversight.

export const STAGE_DATA_KEY: Record<string, string> = {
  Shortlist: "shortlist",
  Concept: "concept",
  "Prototyping / Field-Testing": "prototyping",
  "Go-Live": "goLive",
  Distribution: "distribution",
};

export function stageDataKeyFor(stageName: string): string | null {
  return STAGE_DATA_KEY[stageName] ?? null;
}

export type ChecklistItem = { key: string; label: string };

export type Visual = {
  path: string;
  uploadedBy: string;
  createdAt: string;
};

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export type ShortlistData = {
  reasoning?: string;
  checklist?: Record<string, boolean>;
};

export type ConceptData = {
  place?: string | null;
  story?: string | null;
  operationalDetails?: string | null;
  audience?: string | null;
  notes?: string | null;
  visuals?: Visual[];
};

export type PrototypingData = {
  testDate?: string | null;
  audienceTested?: string | null;
  mvpDescription?: string | null;
  results?: string | null;
};

export type GoLiveData = {
  checklist?: Record<string, boolean>;
};

export const DISTRIBUTION_CHANNELS = [
  { key: "ota", label: "OTA" },
  { key: "visit_saudi", label: "Visit Saudi app/site" },
  { key: "partner_direct", label: "Partner direct booking" },
  { key: "travel_agents", label: "Travel agents" },
] as const;

export type DistributionData = {
  channels?: string[];
  requirements?: string | null;
  todo?: TodoItem[];
};

export type StageData = {
  shortlist?: ShortlistData;
  concept?: ConceptData;
  prototyping?: PrototypingData;
  goLive?: GoLiveData;
  distribution?: DistributionData;
};
