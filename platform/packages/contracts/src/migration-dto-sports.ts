import type { LegacyMigrationSnapshot } from "./migration";
import {
  transformLegacySnapshotToStagingDtos,
  type ChallengeMigrationDto,
  type LegacyMigrationStagingBundle,
} from "./migration-dto";
import {
  validateSportsPeriodManifest,
  type SportsPeriodIssue,
  type SportsPeriodManifest,
} from "./migration-sports-period";

export type ChallengeWithSportsPeriodMigrationDto = ChallengeMigrationDto & {
  sportsStartsAt: string;
  sportsEndsAt: string;
  sportsSourceNote: string;
};

export type LegacyMigrationStagingWithSportsBundle = Omit<
  LegacyMigrationStagingBundle,
  "challenges" | "unresolvedDestinationFields"
> & {
  unresolvedDestinationFields: readonly string[];
  sportsPeriodIssues: SportsPeriodIssue[];
  challenges: ChallengeWithSportsPeriodMigrationDto[];
};

const sportsDestinationFields = [
  "public.challenges.sports_starts_at",
  "public.challenges.sports_ends_at",
] as const;

function blockedBySportsPeriod(
  base: LegacyMigrationStagingBundle,
  issues: SportsPeriodIssue[],
): LegacyMigrationStagingWithSportsBundle {
  return {
    ...base,
    ready: false,
    unresolvedDestinationFields: sportsDestinationFields,
    sportsPeriodIssues: issues,
    challenges: [],
    challengeGoals: [],
    challengeOffers: [],
    challengeOfferGoals: [],
    pricingGroups: [],
    pricingGroupOffers: [],
    pricingLots: [],
    participants: [],
    registrations: [],
    payments: [],
    inventory: [],
  };
}

export function transformLegacySnapshotToStagingDtosWithSportsPeriods(
  snapshot: LegacyMigrationSnapshot,
  manifest: SportsPeriodManifest,
): LegacyMigrationStagingWithSportsBundle {
  const base = transformLegacySnapshotToStagingDtos(snapshot);

  if (!base.ready) {
    return {
      ...base,
      sportsPeriodIssues: [],
      challenges: [],
    };
  }

  const sports = validateSportsPeriodManifest(
    base.challenges.map((challenge) => challenge.legacyChallengeKey),
    manifest,
  );

  if (!sports.ok) {
    return blockedBySportsPeriod(base, sports.issues);
  }

  const challenges = base.challenges.map((challenge) => {
    const period = sports.byChallengeKey.get(challenge.legacyChallengeKey);
    if (!period) {
      throw new Error(
        `sports period missing after successful validation: ${challenge.legacyChallengeKey}`,
      );
    }

    return {
      ...challenge,
      sportsStartsAt: period.sportsStartsAt,
      sportsEndsAt: period.sportsEndsAt,
      sportsSourceNote: period.sourceNote,
    };
  });

  return {
    ...base,
    unresolvedDestinationFields: [],
    sportsPeriodIssues: [],
    challenges,
  };
}
