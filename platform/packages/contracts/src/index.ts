export type ApiSuccess<T> = {
  data: T;
  requestId: string;
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
  };
  requestId: string;
};

export const permissions = [
  "admin.access",
  "admin.users.manage",
  "admin.users.read",
  "audit.read",
  "challenges.manage",
  "challenges.read",
  "inventory.manage",
  "inventory.read",
  "medal_deliveries.manage",
  "medal_deliveries.read",
  "operations.read",
  "participants.manage",
  "participants.read",
  "payments.manage",
  "payments.read",
  "public_registrations.manage",
  "public_registrations.read",
  "rbac.manage",
  "rbac.read",
  "registrations.manage",
  "registrations.read",
] as const;

export type Permission = (typeof permissions)[number];

export function isPermission(value: string): value is Permission {
  return (permissions as readonly string[]).includes(value);
}

export * from "./migration";
export * from "./migration-payments";
export * from "./migration-plan";
