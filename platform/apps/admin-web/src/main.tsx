import { createClient, type Session } from "@supabase/supabase-js";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { isAdminContext, type AdminContext } from "./session";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  string | undefined;
const environment =
  (import.meta.env.VITE_PORTAL_GIRO_ENV as string | undefined) ?? "development";
const applicationVersion =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "cycle-2";

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias.",
  );
}

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

type ViewState = "checking" | "login" | "authorized" | "denied";

async function writeAudit(
  action: string,
  outcome: "success" | "failure" | "denied",
  reason?: string,
) {
  await supabase.rpc("write_audit_event", {
    event_action: action,
    event_application_version: applicationVersion,
    event_metadata: { environment },
    event_outcome: outcome,
    event_reason: reason ?? null,
    event_request_id: crypto.randomUUID(),
    event_resource_type: "admin_session",
  });
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<AdminContext | null>(null);
  const [view, setView] = useState<ViewState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Verificando sessão…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) {
        setView("login");
        setMessage("");
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setContext(null);
        setView("login");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setView("checking");
    setMessage("Validando permissões…");

    void supabase.rpc("current_admin_context").then(async ({ data, error }) => {
      if (!active) return;
      if (error || !isAdminContext(data)) {
        setView("denied");
        setMessage("Este usuário não possui acesso administrativo.");
        await writeAudit(
          "admin.login.denied",
          "denied",
          "Usuário autenticado sem permissão administrativa.",
        );
        return;
      }
      setContext(data);
      setView("authorized");
      setMessage("Acesso administrativo confirmado.");
      await writeAudit("admin.login.success", "success");
    });

    return () => {
      active = false;
    };
  }, [session]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("Verificando e-mail e senha…");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPassword("");
    if (error) {
      setMessage("E-mail ou senha inválidos.");
      setView("login");
    }
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    if (view === "authorized") await writeAudit("admin.logout", "success");
    await supabase.auth.signOut();
    setBusy(false);
    setMessage("Sessão encerrada com segurança.");
  }

  async function requestPasswordReset() {
    if (!email) {
      setMessage("Informe seu e-mail para solicitar a recuperação de senha.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setMessage(
      error
        ? "Não foi possível solicitar a recuperação agora."
        : "Se o e-mail estiver cadastrado, você receberá as orientações.",
    );
    setBusy(false);
  }

  if (view === "checking") {
    return (
      <main className="shell">
        <section className="card" aria-busy="true">
          <p className="eyebrow">Portal Giro</p>
          <h1>Área administrativa</h1>
          <p role="status" className="status">
            {message}
          </p>
        </section>
      </main>
    );
  }

  if (view === "login") {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Portal Giro</p>
          <h1>Área administrativa</h1>
          <p>Acesso exclusivo para integrantes autorizados da equipe.</p>
          <form onSubmit={signIn}>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
          <button
            type="button"
            className="link-button"
            onClick={() => void requestPasswordReset()}
            disabled={busy}
          >
            Esqueci minha senha
          </button>
          <p role="status" className="status">
            {message}
          </p>
          <p className="environment">Ambiente: desenvolvimento</p>
        </section>
      </main>
    );
  }

  if (view === "denied") {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow warning">Acesso restrito</p>
          <h1>Permissão necessária</h1>
          <p>{message}</p>
          <button disabled={busy} onClick={() => void signOut()}>
            Voltar para o login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="card dashboard">
        <div className="status-row">
          <span className="dot" aria-hidden="true" />
          <span>Ambiente de desenvolvimento conectado</span>
        </div>
        <p className="eyebrow">Fundação técnica</p>
        <h1>Painel administrativo</h1>
        <p>Autenticação, autorização e banco estão funcionando.</p>
        <dl>
          <dt>Usuário conectado</dt>
          <dd>{session?.user.email ?? "E-mail não disponível"}</dd>
          <dt>Papel</dt>
          <dd>{context?.roles.join(", ")}</dd>
          <dt>Permissões ativas</dt>
          <dd>{context?.permissions.length}</dd>
          <dt>Versão</dt>
          <dd>{applicationVersion}</dd>
        </dl>
        <p role="status" className="status success">
          {message}
        </p>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void signOut()}
        >
          {busy ? "Saindo…" : "Sair com segurança"}
        </button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
