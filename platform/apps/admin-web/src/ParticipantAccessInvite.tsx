import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";

type Props = {
  supabase: SupabaseClient;
  participantId: string;
  participantName: string;
  participantStatus: "ACTIVE" | "INACTIVE" | "MERGED";
  apiUrl?: string;
};

type ApiError = {
  error?: { code?: string; message?: string };
};

export function ParticipantAccessInvite({
  supabase,
  participantId,
  participantName,
  participantStatus,
  apiUrl,
}: Props) {
  const resolvedApiUrl =
    apiUrl ?? (import.meta.env.VITE_API_URL as string | undefined);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function inviteParticipant(event: React.FormEvent) {
    event.preventDefault();

    if (!resolvedApiUrl) {
      setMessage("A API de convites ainda não está configurada neste ambiente.");
      return;
    }

    setBusy(true);
    setMessage("Enviando convite…");

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setMessage("Sua sessão expirou. Entre novamente para liberar o acesso.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(
        `${resolvedApiUrl.replace(/\/$/, "")}/admin/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim() }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as ApiError;

      if (!response.ok) {
        setMessage(
          payload.error?.message ?? "Não foi possível enviar o convite agora.",
        );
        return;
      }

      setEmail("");
      setOpen(false);
      setMessage(`Acesso ao Meu Giro enviado para ${participantName}.`);
    } catch {
      setMessage("Não foi possível conectar à API de convites.");
    } finally {
      setBusy(false);
    }
  }

  if (participantStatus !== "ACTIVE") {
    return <span>Acesso indisponível para participante inativo.</span>;
  }

  return (
    <div>
      <button
        type="button"
        className="compact"
        disabled={busy}
        onClick={() => {
          setOpen((value) => !value);
          setMessage("");
        }}
      >
        {open ? "Cancelar acesso" : "Liberar Meu Giro"}
      </button>
      {open ? (
        <form className="challenge-form" onSubmit={inviteParticipant}>
          <label>
            E-mail do participante
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="participante@email.com"
              autoComplete="email"
              required
              disabled={busy}
            />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Enviando…" : "Enviar convite de acesso"}
            </button>
          </div>
        </form>
      ) : null}
      {message ? (
        <p role="status" className="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
