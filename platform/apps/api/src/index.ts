import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Bindings, Variables } from "./types";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", logger());
app.use("*", async (context, next) => {
  context.set(
    "requestId",
    context.req.header("x-request-id") ?? crypto.randomUUID(),
  );
  await next();
  context.header("x-request-id", context.get("requestId"));
});
app.use(
  "*",
  cors({
    allowHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    origin: (origin, context) =>
      origin === context.env.ADMIN_WEB_ORIGIN
        ? origin
        : context.env.ADMIN_WEB_ORIGIN,
  }),
);

app.get("/health", (context) =>
  context.json({
    data: { environment: context.env.PORTAL_GIRO_ENV, status: "ok" },
    requestId: context.get("requestId"),
  }),
);

app.use("/admin/*", async (context, next) => {
  const authorization = context.req.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    return context.json(
      {
        error: { code: "UNAUTHENTICATED", message: "Autenticação necessária." },
        requestId: context.get("requestId"),
      },
      401,
    );
  }

  const supabase = createClient(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_ANON_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return context.json(
      {
        error: {
          code: "INVALID_SESSION",
          message: "Sessão inválida ou expirada.",
        },
        requestId: context.get("requestId"),
      },
      401,
    );
  }

  context.set("userId", data.user.id);
  await next();
});

app.get("/admin/session", async (context) => {
  const token = context.req.header("authorization")!.slice("Bearer ".length);
  const supabase = createClient(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_ANON_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { data, error } = await supabase.rpc("current_admin_context");

  if (error || !data) {
    return context.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Acesso administrativo não autorizado.",
        },
        requestId: context.get("requestId"),
      },
      403,
    );
  }

  const requestId = context.get("requestId");
  const parsedRequestId = /^[0-9a-f-]{36}$/i.test(requestId)
    ? requestId
    : crypto.randomUUID();
  await supabase.rpc("write_audit_event", {
    event_action: "admin.session.read",
    event_application_version: "0.1.0",
    event_metadata: { environment: context.env.PORTAL_GIRO_ENV },
    event_outcome: "success",
    event_request_id: parsedRequestId,
    event_resource_type: "admin_session",
  });

  return context.json({ data, requestId });
});

app.post("/admin/participants/:participantId/invite", async (context) => {
  const participantId = context.req.param("participantId");
  if (!/^[0-9a-f-]{36}$/i.test(participantId)) {
    return context.json(
      {
        error: {
          code: "INVALID_PARTICIPANT",
          message: "Participante inválido.",
        },
        requestId: context.get("requestId"),
      },
      400,
    );
  }

  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json(
      {
        error: { code: "INVALID_BODY", message: "Dados do convite inválidos." },
        requestId: context.get("requestId"),
      },
      400,
    );
  }

  const email =
    body && typeof body === "object" && "email" in body
      ? String((body as { email?: unknown }).email ?? "")
          .trim()
          .toLocaleLowerCase("en-US")
      : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return context.json(
      {
        error: { code: "INVALID_EMAIL", message: "Informe um e-mail válido." },
        requestId: context.get("requestId"),
      },
      400,
    );
  }

  const token = context.req.header("authorization")!.slice("Bearer ".length);
  const userClient = createClient(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_ANON_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const permission = await userClient.rpc("has_permission", {
    required_permission: "participants.manage",
  });

  if (permission.error || permission.data !== true) {
    return context.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Permissão para gerenciar participantes é necessária.",
        },
        requestId: context.get("requestId"),
      },
      403,
    );
  }

  const serviceClient = createClient(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const participant = await serviceClient
    .from("participants")
    .select("id,status")
    .eq("id", participantId)
    .maybeSingle();

  if (participant.error || !participant.data) {
    return context.json(
      {
        error: {
          code: "PARTICIPANT_NOT_FOUND",
          message: "Participante não encontrado.",
        },
        requestId: context.get("requestId"),
      },
      404,
    );
  }

  if (participant.data.status !== "ACTIVE") {
    return context.json(
      {
        error: {
          code: "PARTICIPANT_INACTIVE",
          message: "O participante precisa estar ativo para receber acesso.",
        },
        requestId: context.get("requestId"),
      },
      409,
    );
  }

  const existingLink = await serviceClient
    .from("participant_user_links")
    .select("user_id")
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existingLink.error) {
    throw existingLink.error;
  }
  if (existingLink.data) {
    return context.json(
      {
        error: {
          code: "PARTICIPANT_ALREADY_LINKED",
          message: "Este participante já possui uma conta vinculada.",
        },
        requestId: context.get("requestId"),
      },
      409,
    );
  }

  const invited = await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: context.env.ADMIN_WEB_ORIGIN,
  });

  if (invited.error || !invited.data.user) {
    return context.json(
      {
        error: {
          code: "INVITE_FAILED",
          message:
            "Não foi possível enviar o convite. Verifique se o e-mail já possui uma conta.",
        },
        requestId: context.get("requestId"),
      },
      409,
    );
  }

  const linked = await serviceClient.from("participant_user_links").insert({
    participant_id: participantId,
    user_id: invited.data.user.id,
  });

  if (linked.error) {
    await serviceClient.auth.admin.deleteUser(invited.data.user.id);
    throw linked.error;
  }

  const requestId = context.get("requestId");
  await userClient.rpc("write_audit_event", {
    event_action: "participant.access.invited",
    event_application_version: "0.1.0",
    event_metadata: { participant_id: participantId },
    event_outcome: "success",
    event_request_id: /^[0-9a-f-]{36}$/i.test(requestId)
      ? requestId
      : crypto.randomUUID(),
    event_resource_id: participantId,
    event_resource_type: "participant",
  });

  return context.json(
    {
      data: { participantId, status: "invited" },
      requestId,
    },
    201,
  );
});

app.notFound((context) =>
  context.json(
    {
      error: { code: "NOT_FOUND", message: "Recurso não encontrado." },
      requestId: context.get("requestId"),
    },
    404,
  ),
);

app.onError((error, context) => {
  console.error(
    JSON.stringify({
      error: error.message,
      requestId: context.get("requestId"),
    }),
  );
  return context.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir a operação.",
      },
      requestId: context.get("requestId"),
    },
    500,
  );
});

export default app;
