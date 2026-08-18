import { createClient, type Session } from "@supabase/supabase-js";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChallengesPanel } from "./ChallengesPanel";
import { ChallengeOperationsSummary } from "./ChallengeOperationsSummary";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { RegistrationsPanel } from "./RegistrationsPanel";
import { PublicRegistrationsPanel } from "./PublicRegistrationsPanel";
import { PaymentsPanel } from "./PaymentsPanel";
import { InventoryPanel } from "./InventoryPanel";
import { MedalDeliveriesPanel } from "./MedalDeliveriesPanel";
import { OperationsPanel } from "./OperationsPanel";
import { ActivitiesPanel } from "./ActivitiesPanel";
import { MeuGiroParticipant } from "./MeuGiroParticipant";
import { ParticipantFirstAccess } from "./ParticipantFirstAccess";
import { isAdminContext, type AdminContext } from "./session";
import "./styles.css";
import "./module-nav.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  string | undefined;
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
const environment =
  (import.meta.env.VITE_PORTAL_GIRO_ENV as string | undefined) ?? "development";
const applicationVersion =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "cycle-3";

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

type ViewState =
  | "checking"
  | "login"
  | "password-update"
  | "authorized"
  | "participant"
  | "denied";

type AuditEvent = {
  id: string;
  occurred_at: string;
  action: string;
  resource_type: string;
  outcome: "success" | "failure" | "denied";
};

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
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordUpdateMode, setPasswordUpdateMode] = useState(false);
  const [message, setMessage] = useState("Verificando sessão…");
  const [busy, setBusy] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditMessage, setAuditMessage] = useState("");
  const [auditBusy, setAuditBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) {
        setView("login");
        setMessage("");
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY" && nextSession) {
        setPasswordUpdateMode(true);
        setView("password-update");
        setMessage("Crie uma nova senha para continuar.");
        return;
      }
      if (!nextSession) {
        setContext(null);
        setPasswordUpdateMode(false);
        setView("login");
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || passwordUpdateMode) return;
    let active = true;
    setView("checking");
    setMessage("Validando permissões…");

    void supabase.rpc("current_admin_context").then(async ({ data, error }) => {
      if (!active) return;
      if (error || !isAdminContext(data)) {
        const participant = await supabase.rpc("current_participant_id");
        if (!participant.error && typeof participant.data === "string") {
          setView("participant");
          setMessage("Área do participante carregada.");
          return;
        }
        setView("denied");
        setMessage("Este usuário não possui acesso administrativo ou vínculo com participante.");
        await writeAudit(
          "admin.login.denied",
          "denied",
          "Usuário autenticado sem permissão administrativa ou vínculo com participante.",
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
  }, [passwordUpdateMode, session]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("Verificando e-mail e senha…");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setMessage("As senhas informadas não são iguais.");
      return;
    }
    setBusy(true);
    setMessage("Salvando a nova senha…");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setNewPassword("");
    setPasswordConfirmation("");
    if (error) {
      setMessage("Não foi possível atualizar a senha. Solicite um novo link.");
      setBusy(false);
      return;
    }
    await writeAudit("admin.password.updated", "success");
    await supabase.auth.signOut();
    setPasswordUpdateMode(false);
    setView("login");
    setMessage("Senha criada com sucesso. Entre usando a nova senha.");
    setBusy(false);
  }

  async function loadAuditEvents() {
    setAuditBusy(true);
    setAuditMessage("Carregando registros…");
    const { data, error } = await supabase
      .from("audit_events")
      .select("id,occurred_at,action,resource_type,outcome")
      .order("occurred_at", { ascending: false })
      .limit(25);

    if (error) {
      setAuditEvents([]);
      setAuditMessage("Não foi possível carregar a auditoria agora.");
    } else {
      setAuditEvents((data ?? []) as AuditEvent[]);
      setAuditMessage(
        data?.length
          ? `${data.length} registros mais recentes.`
          : "Nenhum registro de auditoria encontrado.",
      );
    }
    setAuditBusy(false);
  }

  function formatAuditDate(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  if (view === "checking") {
    return (
      <main className="shell">
        <section className="card" aria-busy="true">
          <p className="eyebrow">Portal Giro</p>
          <h1>Carregando acesso</h1>
          <p role="status" className="status">{message}</p>
        </section>
      </main>
    );
  }

  if (view === "login") {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Portal Giro</p>
          <h1>Entrar</h1>
          <p>Acesso para participantes do Meu Giro e integrantes autorizados da equipe.</p>
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
            <button type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
          </form>
          <button
            type="button"
            className="link-button"
            onClick={() => void requestPasswordReset()}
            disabled={busy}
          >
            Esqueci minha senha
          </button>
          <p role="status" className="status">{message}</p>
          <ParticipantFirstAccess apiUrl={apiUrl} />
          <p className="environment">Ambiente: desenvolvimento</p>
        </section>
      </main>
    );
  }

  if (view === "password-update") {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Portal Giro</p>
          <h1>Criar nova senha</h1>
          <p>Use pelo menos 8 caracteres e não reutilize uma senha antiga.</p>
          <form onSubmit={updatePassword}>
            <label>
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
          </form>
          <p role="status" className="status">{message}</p>
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
          <button disabled={busy} onClick={() => void signOut()}>Voltar para o login</button>
        </section>
      </main>
    );
  }

  if (view === "participant") {
    return <MeuGiroParticipant supabase={supabase} onSignOut={signOut} />;
  }

  return (
    <main className="shell dashboard-shell">
      <section className="card dashboard">
        <div className="status-row">
          <span className="dot" aria-hidden="true" />
          <span>Ambiente de desenvolvimento conectado</span>
        </div>
        <p className="eyebrow">Portal Giro</p>
        <h1>Painel administrativo</h1>
        <p role="status" className="status success">{message}</p>

        <nav className="module-nav" aria-label="Módulos administrativos">
          {context?.permissions.includes("operations.read") ? <a href="#operations-title">Operação</a> : null}
          {context?.permissions.includes("public_registrations.read") ? <a href="#public-registrations-title">Pré-inscrições</a> : null}
          {context?.permissions.includes("registrations.read") ? <a href="#registrations-title">Inscrições</a> : null}
          {context?.permissions.includes("activities.read") ? <a href="#activities-admin-title">Meu Giro</a> : null}
          {context?.permissions.includes("participants.read") ? <a href="#participants-title">Participantes</a> : null}
          {context?.permissions.includes("challenges.read") ? (
            <>
              <a href="#challenge-operations-title">Resumo dos desafios</a>
              <a href="#challenges-title">Desafios</a>
            </>
          ) : null}
          {context?.permissions.includes("inventory.read") ? <a href="#inventory-title">Estoque</a> : null}
          {context?.permissions.includes("payments.read") ? <a href="#payments-title">Pagamentos</a> : null}
          {context?.permissions.includes("medal_deliveries.read") ? <a href="#medal-deliveries-title">Entrega de medalhas</a> : null}
          {context?.permissions.includes("audit.read") ? <a href="#audit-title">Auditoria</a> : null}
        </nav>

        {context?.permissions.includes("public_registrations.read") ? (
          <PublicRegistrationsPanel
            supabase={supabase}
            canManage={
              context.permissions.includes("public_registrations.manage") &&
              context.permissions.includes("registrations.manage") &&
              context.permissions.includes("payments.manage")
            }
          />
        ) : null}

        {context?.permissions.includes("challenges.read") ? (
          <>
            <ChallengeOperationsSummary supabase={supabase} />
            <ChallengesPanel supabase={supabase} canManage={context.permissions.includes("challenges.manage")} />
          </>
        ) : null}

        {context?.permissions.includes("participants.read") ? (
          <ParticipantsPanel supabase={supabase} canManage={context.permissions.includes("participants.manage")} />
        ) : null}

        {context?.permissions.includes("registrations.read") ? (
          <RegistrationsPanel supabase={supabase} canManage={context.permissions.includes("registrations.manage")} />
        ) : null}

        {context?.permissions.includes("activities.read") ? (
          <ActivitiesPanel supabase={supabase} canManage={context.permissions.includes("activities.manage")} />
        ) : null}

        {context?.permissions.includes("medal_deliveries.read") ? (
          <MedalDeliveriesPanel supabase={supabase} canManage={context.permissions.includes("medal_deliveries.manage")} />
        ) : null}

        {context?.permissions.includes("inventory.read") ? (
          <InventoryPanel supabase={supabase} canManage={context.permissions.includes("inventory.manage")} />
        ) : null}

        {context?.permissions.includes("payments.read") ? (
          <PaymentsPanel supabase={supabase} canManage={context.permissions.includes("payments.manage")} />
        ) : null}

        {context?.permissions.includes("operations.read") ? <OperationsPanel supabase={supabase} /> : null}

        {context?.permissions.includes("audit.read") ? (
          <section className="audit-panel" aria-labelledby="audit-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Segurança</p>
                <h2 id="audit-title">Auditoria recente</h2>
              </div>
              <button
                type="button"
                className="compact"
                disabled={auditBusy}
                onClick={() => void loadAuditEvents()}
              >
                {auditBusy ? "Carregando…" : auditEvents.length ? "Atualizar" : "Carregar registros"}
              </button>
            </div>
            <p className="section-description">Consulta somente leitura das 25 ações administrativas mais recentes.</p>
            <p role="status" className="status">{auditMessage}</p>
            {auditEvents.length > 0 ? (
              <div className="audit-list">
                {auditEvents.map((event) => (
                  <article className="audit-item" key={event.id}>
                    <div>
                      <strong>{event.action}</strong>
                      <span>{event.resource_type}</span>
                    </div>
                    <div className="audit-meta">
                      <span className={`outcome ${event.outcome}`}>
                        {event.outcome === "success" ? "Sucesso" : event.outcome === "denied" ? "Negado" : "Falha"}
                      </span>
                      <time dateTime={event.occurred_at}>{formatAuditDate(event.occurred_at)}</time>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="account-panel">
          <details>
            <summary>Conta e acesso</summary>
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
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setPasswordUpdateMode(true);
                setView("password-update");
                setMessage("Crie uma nova senha para continuar.");
              }}
            >
              Criar ou alterar senha
            </button>
            <button className="secondary spaced" disabled={busy} onClick={() => void signOut()}>
              {busy ? "Saindo…" : "Sair com segurança"}
            </button>
          </details>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
