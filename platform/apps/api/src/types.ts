export type Bindings = {
  ADMIN_WEB_ORIGIN: string;
  PORTAL_GIRO_ENV: "local" | "staging" | "production";
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
};

export type Variables = {
  requestId: string;
  userId: string;
};
