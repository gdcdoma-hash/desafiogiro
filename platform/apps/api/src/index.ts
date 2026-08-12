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
    allowMethods: ["GET", "OPTIONS"],
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
