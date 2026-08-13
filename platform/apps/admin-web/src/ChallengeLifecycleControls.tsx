import type { SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";

type ChallengeStatus =
  "DRAFT" | "SCHEDULED" | "ACTIVE" | "FINISHED" | "CANCELLED" | "ARCHIVED";

type Props = {
  supabase: SupabaseClient;
  challengeId: string;
  status: ChallengeStatus;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
};

const labels: Record<ChallengeStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Programado",
  ACTIVE: "Ativo",
  FINISHED: "Encerrado",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};

const transitions: Record<ChallengeStatus, ChallengeStatus[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["FINISHED", "CANCELLED"],
  FINISHED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function ChallengeLifecycleControls({
  supabase,
  challengeId,
  status,
  canManage,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const available = useMemo(() => transitions[status], [status]);

  async function moveTo(nextStatus: ChallengeStatus) {
    if (!canManage || busy) return;
    setBusy(true);
    setMessage(`Alterando para ${labels[nextStatus].toLowerCase()}…`);
    const { error } = await supabase
      .from("challenges")
      .update({ status: nextStatus })
      .eq("id", challengeId);

    if (error) {
      const known = error.message.includes("at least one active goal")
        ? "Adicione pelo menos uma meta ativa antes de programar ou ativar."
        : "Não foi possível alterar a situação do desafio.";
      setMessage(known);
      setBusy(false);
      return;
    }

    setMessage(`Situação alterada para ${labels[nextStatus].toLowerCase()}.`);
    await onChanged();
    setBusy(false);
  }

  return (
    <section
      className="config-card"
      aria-labelledby="challenge-lifecycle-title"
    >
      <div className="section-heading">
        <div>
          <h3 id="challenge-lifecycle-title">Situação da edição</h3>
          <p className="mini-description">
            Estado atual: <strong>{labels[status]}</strong>. As mudanças seguem
            o fluxo operacional protegido pelo banco.
          </p>
        </div>
      </div>

      {available.length && canManage ? (
        <div className="form-actions">
          {available.map((nextStatus) => (
            <button
              type="button"
              className={nextStatus === "CANCELLED" ? "secondary" : undefined}
              disabled={busy}
              key={nextStatus}
              onClick={() => void moveTo(nextStatus)}
            >
              {labels[nextStatus]}
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-note">
          {status === "ARCHIVED"
            ? "Esta edição está arquivada e não possui novas transições."
            : canManage
              ? "Nenhuma transição disponível."
              : "Seu perfil possui acesso somente para consulta."}
        </p>
      )}

      <p role="status" className="status">
        {message}
      </p>
    </section>
  );
}
