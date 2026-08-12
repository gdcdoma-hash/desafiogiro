export type AdminContext = {
  permissions: string[];
  roles: string[];
  user_id: string;
};

export function isAdminContext(value: unknown): value is AdminContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<AdminContext>;
  return (
    typeof context.user_id === "string" &&
    Array.isArray(context.roles) &&
    context.roles.includes("platform_admin") &&
    Array.isArray(context.permissions) &&
    context.permissions.includes("admin.access")
  );
}
