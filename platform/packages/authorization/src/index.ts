import type { Permission } from "@portal-giro/contracts";

export function hasPermission(
  granted: readonly string[],
  required: Permission,
): boolean {
  return granted.includes(required);
}

export function requirePermission(
  granted: readonly string[],
  required: Permission,
): void {
  if (!hasPermission(granted, required)) {
    throw new AuthorizationError(required);
  }
}

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";

  constructor(readonly requiredPermission: Permission) {
    super("Você não possui permissão para realizar esta ação.");
    this.name = "AuthorizationError";
  }
}
