import { createClient, type Session } from "@supabase/supabase-js";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  string | undefined;
const apiUrl =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:8787";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.",
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AdminContext = { permissions: string[]; roles: string[]; user_id: string };

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<AdminContext | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setContext(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void fetch(`${apiUrl}/admin/session`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: AdminContext;
          error?: { message: string };
        };
        if (!response.ok || !payload.data)
          throw new Error(payload.error?.message ?? "Acesso negado.");
        setContext(payload.data);
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "Acesso negado."),
      );
  }, [session]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Verificando acesso…");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPassword("");
    setMessage(error ? "E-mail ou senha inválidos." : "Acesso confirmado.");
  }

  if (!session) {
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
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit">Entrar</button>
          </form>
          <p role="status" className="status">
            {message}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">Fundação técnica</p>
        <h1>Ambiente administrativo</h1>
        {context ? (
          <>
            <p>Autenticação e autorização estão funcionando.</p>
            <dl>
              <dt>Papéis</dt>
              <dd>{context.roles.join(", ")}</dd>
              <dt>Permissões</dt>
              <dd>{context.permissions.join(", ")}</dd>
            </dl>
          </>
        ) : (
          <p>Validando permissões…</p>
        )}
        <p role="status" className="status">
          {message}
        </p>
        <button
          className="secondary"
          onClick={() => void supabase.auth.signOut()}
        >
          Sair
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
