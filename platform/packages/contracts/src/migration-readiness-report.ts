import type { LegacyMigrationSnapshot } from "./migration";
import { transformLegacySnapshotToStagingDtosWithSportsPeriods } from "./migration-dto-sports";
import type { SportsPeriodManifest } from "./migration-sports-period";

export type MigrationReadinessDomain =
  | "CHALLENGES"
  | "PRICING"
  | "PARTICIPANTS"
  | "REGISTRATIONS"
  | "PAYMENTS"
  | "INVENTORY";

export type MigrationReadinessStep = {
  order: number;
  domain: MigrationReadinessDomain;
  destinationTables: readonly string[];
  stagedRows: number;
  dependsOn: readonly MigrationReadinessDomain[];
};

export type MigrationReadinessReport = {
  stagingReady: boolean;
  persistenceEnabled: false;
  writeMode: "NONE";
  unresolvedDestinationFields: readonly string[];
  issueCounts: {
    structural: number;
    payments: number;
    offers: number;
    goals: number;
    pricing: number;
    sportsPeriods: number;
  };
  totalStagedRows: number;
  steps: MigrationReadinessStep[];
};

export function buildLegacyMigrationReadinessReport(
  snapshot: LegacyMigrationSnapshot,
  sportsPeriodManifest: SportsPeriodManifest,
): MigrationReadinessReport {
  const staging = transformLegacySnapshotToStagingDtosWithSportsPeriods(
    snapshot,
    sportsPeriodManifest,
  );

  const steps: MigrationReadinessStep[] = [
    {
      order: 1,
      domain: "CHALLENGES",
      destinationTables: [
        "public.challenges",
        "public.challenge_goals",
        "public.challenge_offers",
        "public.challenge_offer_goals",
      ],
      stagedRows:
        staging.challenges.length +
        staging.challengeGoals.length +
        staging.challengeOffers.length +
        staging.challengeOfferGoals.length,
      dependsOn: [],
    },
    {
      order: 2,
      domain: "PRICING",
      destinationTables: [
        "public.challenge_pricing_groups",
        "public.challenge_pricing_group_offers",
        "public.challenge_offer_price_lots",
      ],
      stagedRows:
        staging.pricingGroups.length +
        staging.pricingGroupOffers.length +
        staging.pricingLots.length,
      dependsOn: ["CHALLENGES"],
    },
    {
      order: 3,
      domain: "PARTICIPANTS",
      destinationTables: ["public.participants"],
      stagedRows: staging.participants.length,
      dependsOn: [],
    },
    {
      order: 4,
      domain: "REGISTRATIONS",
      destinationTables: ["public.registrations"],
      stagedRows: staging.registrations.length,
      dependsOn: ["CHALLENGES", "PARTICIPANTS"],
    },
    {
      order: 5,
      domain: "PAYMENTS",
      destinationTables: ["public.registration_payments"],
      stagedRows: staging.payments.length,
      dependsOn: ["REGISTRATIONS"],
    },
    {
      order: 6,
      domain: "INVENTORY",
      destinationTables: [
        "public.inventory_items",
        "public.inventory_movements",
        "public.inventory_reservations",
      ],
      stagedRows: staging.inventory.length,
      dependsOn: ["CHALLENGES", "REGISTRATIONS"],
    },
  ];

  return {
    stagingReady:
      staging.ready && staging.unresolvedDestinationFields.length === 0,
    persistenceEnabled: false,
    writeMode: "NONE",
    unresolvedDestinationFields: staging.unresolvedDestinationFields,
    issueCounts: {
      structural: staging.structuralIssues.length,
      payments: staging.paymentIssues.length,
      offers: staging.offerIssues.length,
      goals: staging.goalIssues.length,
      pricing: staging.pricingIssues.length,
      sportsPeriods: staging.sportsPeriodIssues.length,
    },
    totalStagedRows: steps.reduce((total, step) => total + step.stagedRows, 0),
    steps,
  };
}
