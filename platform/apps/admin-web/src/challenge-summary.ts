export type ChallengeStatus =
  "DRAFT" | "SCHEDULED" | "ACTIVE" | "FINISHED" | "CANCELLED" | "ARCHIVED";

export type ChallengeSummaryItem = {
  status: ChallengeStatus;
  is_public: boolean;
};

export type ChallengeSummary = {
  total: number;
  draft: number;
  scheduled: number;
  active: number;
  finished: number;
  cancelled: number;
  archived: number;
  publicCount: number;
  privateCount: number;
};

export function summarizeChallenges(
  items: ChallengeSummaryItem[],
): ChallengeSummary {
  const summary: ChallengeSummary = {
    total: items.length,
    draft: 0,
    scheduled: 0,
    active: 0,
    finished: 0,
    cancelled: 0,
    archived: 0,
    publicCount: 0,
    privateCount: 0,
  };

  for (const item of items) {
    if (item.status === "DRAFT") summary.draft += 1;
    if (item.status === "SCHEDULED") summary.scheduled += 1;
    if (item.status === "ACTIVE") summary.active += 1;
    if (item.status === "FINISHED") summary.finished += 1;
    if (item.status === "CANCELLED") summary.cancelled += 1;
    if (item.status === "ARCHIVED") summary.archived += 1;
    if (item.is_public) summary.publicCount += 1;
    else summary.privateCount += 1;
  }

  return summary;
}
