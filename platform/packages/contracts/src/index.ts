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
  "admin.users.read",
  "admin.users.manage",
  "rbac.read",
  "rbac.manage",
  "audit.read",
] as const;

export type Permission = (typeof permissions)[number];
