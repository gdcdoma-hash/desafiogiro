import type { SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";

type OfferStatus = "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "DISABLED";
type ChallengeStatus =
  "DRAFT" | "SCHEDULED" | "ACTIVE" | "FINISHED" | "CANCELLED" | "ARCHIVED";

type Props = {
  supabase: SupabaseClient;
  offerId: string;
  offerStatus: OfferStatus;
  challengeStatus: ChallengeStatus;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
};

type Transition = {
  status: OfferStatus;
  label: string;
  requiresOpenChallenge?: boolean;
};

const transitions: Record<OfferStatus, Transition[]> = {
  DRAFT: [
    { status: "SCHEDULED", label: "Programar oferta" },
    { status: "OPEN", label: "Abrir inscrições", requiresOpenChallenge: true },
    { status: "DISABLED", label: "Desativar" },
  ],
  SCHEDULED: [
    { status: "OPEN", label: "Abrir inscrições", requiresOpenChallenge: true },
    { status: "CLOSED", label: "Encerrar oferta" },
    { status: "DISABLED", label: "Desativar" },
  ],
  OPEN: [
    { status: "CLOSED", label: "Encerrar inscrições" },
    { status: "DISABLED", label: "Desativar" },
  ],
  CLOSED: [{ status: "DISABLED", label: "Desativar" }],
  DISABLED: [],
};

const statusLabels: Record<OfferStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Programada",
  OPEN: "Aberta",
  CLOSED: "Encerrada",
  DISABLED: "Desativada",
};

function challengeAllowsOpening(status: ChallengeStatus) {
  return status === "SCHEDULED" || status === "ACTIVE";
}

export function OfferLifecycleControls({
  supabase,
  offerId,
  offerStatus,
  challengeStatus,
  canManage,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const available = useMemo(
    () =>
      transitions[offerStatus].map((transition) => ({
        ...transition,
        disabled:
          transition.requiresOpenChallenge &&
          !challengeAllowsOpening(challengeStatus),
      })),
    [challengeStatus, offerStatus],
  );

  async function changeStatus(next: OfferStatus) {
    if (!canManage || busy) return;
    if (next === "OPEN" && !challengeAllowsOpening(challengeStatus)) {
      setMessage(
        "A oferta só pode ser aberta quando o desafio estiver programado ou ativo.",
      );
      return;
    }

    setBusy(true);
    setMessage("Atualizando situação da oferta…");
    const { error } = await supabase
      .from("challenge_offers")
      .update({ status: next })
      .eq("id", offerId);

    if (error) {
      setMessage(
        error.message.includes("at least one goal")
          ? "A oferta precisa ter pelo menos uma meta vinculada antes desta mudança."
          : error.message.includes("scheduled or active challenge")
            ? "A oferta só pode ser aberta quando o desafio estiver programado ou ativo."
            : "Não foi possível alterar a situação da oferta.",
      );
      setBusy(false);
      return;
    }

    await supabase.rpc("write_audit_event", {
      event_action: "challenge_offer.status.changed",
      event_application_version: "challenges-cycle-6",
      event_metadata: { from: offerStatus, offer_id: offerId, to: next },
      event_outcome: "success",
      event_reason: null,
      event_request_id: crypto.randomUUID(),
      event_resource_type: "challenge_offer",
    });

    setMessage(`Oferta alterada para ${statusLabels[next].toLowerCase()}.`);
    await onChanged();
    setBusy(false);
  }

  if (!canManage || !available.length) return null;

  return (
    <div className="lifecycle-controls" aria-label="Ações da oferta">
      <div className="form-actions">
        {available.map((transition) => (
          <button
            type="button"
            className="compact"
            key={transition.status}
            disabled={busy || transition.disabled}
            onClick={() => void changeStatus(transition.status)}
            title={
              transition.disabled
                ? "O desafio precisa estar programado ou ativo."
                : undefined
            }
          >
            {transition.label}
          </button>
        ))}
      </div>
      {message ? (
        <p role="status" className="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
