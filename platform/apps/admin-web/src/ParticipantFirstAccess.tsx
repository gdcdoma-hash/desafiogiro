import { useState } from "react";

type Props = {
  apiUrl?: string;
};

export function ParticipantFirstAccess({ apiUrl }: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function requestAccess(event: React.FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLocaleLowerCase("en-US");
    if (!apiUrl) {
      setMessage("O acesso do participante ainda não está disponível neste ambiente.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage("Informe um e-mail válido.");
      return;
    }

    setBusy(true);
    setMessage("Verificando sua inscrição…");
    try {
      await fetch(`${apiUrl.replace(/\/$/, "")}/participant/access/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      setMessage(
        "Se este e-mail estiver vinculado a uma inscrição confirmada ou concluída, você receberá as orientações de acesso.",
      );
    } catch {
      setMessage("Não foi possível solicitar o acesso agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="participant-first-access-title">
      <hr />
      <p className="eyebrow">Participante</p>
      <h2 id="participant-first-access-title">Primeiro acesso ao Meu Giro</h2>
      <p>
        Quem possui inscrição confirmada ou concluída não precisa de liberação
        manual. Informe o mesmo e-mail cadastrado na inscrição.
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
          {busy ? "Verificando…" : "Solicitar primeiro acesso"}
        </button>
      </form>
      <p role="status" className="status">
        {message}
      </p>
    </section>
  );
}
