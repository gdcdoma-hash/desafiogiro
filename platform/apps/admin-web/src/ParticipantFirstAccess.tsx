import { useState } from "react";

type Props = {
  apiUrl?: string;
};

export function ParticipantFirstAccess({ apiUrl }: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const area = new URLSearchParams(window.location.search).get("area");
  const participantEntry = area === "participante" || area === "meu-giro";

  if (!participantEntry) return null;

  async function requestAccess(event: React.FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLocaleLowerCase("en-US");
    if (!apiUrl) {
      setMessage(
        "O acesso do participante ainda não está disponível neste ambiente.",
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage("Informe um e-mail válido.");
      return;
    }

    setBusy(true);
    setMessage("Verificando sua inscrição…");
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/participant/access/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalized }),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setMessage(
        "Se este e-mail estiver vinculado a uma inscrição paga e confirmada, você receberá as orientações para criar seu acesso ao Portal Giro.",
      );
    } catch {
      setMessage(
        "Não foi possível solicitar o acesso agora. Tente novamente em instantes.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="participant-access-title">
      <hr />
      <p className="eyebrow">Primeiro acesso</p>
      <h2 id="participant-access-title">Criar acesso ao Portal Giro</h2>
      <p>
        Se sua inscrição já foi paga e confirmada, use o mesmo e-mail cadastrado
        na inscrição para criar sua senha de acesso ao sistema.
      </p>
      <form onSubmit={requestAccess}>
        <label>
          E-mail da inscrição
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Verificando…" : "Criar meu acesso"}
        </button>
      </form>
      <p role="status" className="status">
        {message}
      </p>
    </section>
  );
}
