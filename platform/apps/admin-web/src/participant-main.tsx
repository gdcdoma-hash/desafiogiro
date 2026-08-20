import { createClient, type Session } from "@supabase/supabase-js";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ParticipantFirstAccess } from "./ParticipantFirstAccess";
import { ParticipantPortal } from "./ParticipantPortal";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  string | undefined;
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

if (!supabaseUrl || !publishableKey) {
  throw new Error("Configuração do ambiente incompleta.");
}

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

type ViewState =
  "checking" | "login" | "password-update" | "participant" | "denied";

function ParticipantApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<ViewState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordUpdateMode, setPasswordUpdateMode] = useState(false);
  const [message, setMessage] = useState("Verificando acesso…");
  const [busy, setBusy] = useState(false);

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
    setMessage("Validando sua participação…");

    void supabase.rpc("current_participant_id").then(({ data, error }) => {
      if (!active) return;
      if (!error && typeof data === "string") {
        setView("participant");
        setMessage("Acesso confirmado.");
        return;
      }
      setView("denied");
      setMessage(
        "Esta conta ainda não está vinculada a uma inscrição paga e confirmada.",
      );
    });

    return () => {
      active = false;
    };
  }, [passwordUpdateMode, session]);

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
    await supabase.auth.signOut();
    setBusy(false);
    setMessage("Sessão encerrada.");
  }

  async function requestPasswordReset() {
    if (!email) {
      setMessage("Informe seu e-mail para recuperar o acesso.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?area=participante`,
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
    setPasswordUpdateMode(false);
    setMessage("Senha criada. Carregando seu Portal Giro…");
    setView("checking");
    setBusy(false);
  }

  if (view === "checking") {
    return (
      <main className="shell">
        <section className="card" aria-busy="true">
          <p className="eyebrow">Portal Giro</p>
          <h1>Carregando</h1>
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
          <p className="eyebrow">Área do participante</p>
          <h1>Acessar Portal Giro</h1>
          <p>
            Entre para acessar suas inscrições, Meu Giro, certificados e demais
            recursos do participante.
          </p>
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
              {busy ? "Entrando…" : "Acessar sistema"}
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
          <h1>Criar senha de acesso</h1>
          <p>Use pelo menos 8 caracteres.</p>
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
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar senha e continuar"}
            </button>
          </form>
          <p role="status" className="status">
            {message}
          </p>
        </section>
      </main>
    );
  }

  if (view === "denied") {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow warning">Acesso não localizado</p>
          <h1>Inscrição necessária</h1>
          <p>{message}</p>
          <button disabled={busy} onClick={() => void signOut()}>
            Voltar
          </button>
        </section>
      </main>
    );
  }

  return <ParticipantPortal supabase={supabase} onSignOut={signOut} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ParticipantApp />
  </StrictMode>,
);
