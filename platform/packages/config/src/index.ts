import { z } from "zod";

export const publicConfigSchema = z.object({
  PORTAL_GIRO_ENV: z.enum(["local", "staging", "production"]),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  ADMIN_WEB_ORIGIN: z.url(),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export function parsePublicConfig(input: unknown): PublicConfig {
  return publicConfigSchema.parse(input);
}
