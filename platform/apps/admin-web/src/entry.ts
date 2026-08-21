import { createClient } from "@supabase/supabase-js";

const searchParams = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const area = searchParams.get("area");
const authType = searchParams.get("type") ?? hashParams.get("type");

const participantArea = area === "participante" || area === "meu-giro";
const explicitAdminArea = area === "admin";
const participantAuthReturn = authType === "invite" || authType === "recovery";

async function hasParticipantSession() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    | string
    | undefined;

  if (!supabaseUrl || !publishableKey) return false;

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  });

  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;

  const { data: participantId, error } = await supabase.rpc(
    "current_participant_id",
  );

  return !error && typeof participantId === "string";
}

async function bootstrap() {
  if (participantArea || (!explicitAdminArea && participantAuthReturn)) {
    await import("./participant-main");
    return;
  }

  if (!explicitAdminArea && (await hasParticipantSession())) {
    await import("./participant-main");
    return;
  }

  await import("./main");
}

void bootstrap();
