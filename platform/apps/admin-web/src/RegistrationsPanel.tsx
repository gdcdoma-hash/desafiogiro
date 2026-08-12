import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

type Participant = { id: string; full_name: string };
type Challenge = { id: string; public_name: string };
type Goal = {
  id: string;
  challenge_id: string;
  public_label: string | null;
  target_km: number;
};
type Offer = {
  id: string;
  challenge_id: string;
  public_name: string;
  status: string;
};
type OfferGoal = { offer_id: string; goal_id: string };
type Registration = {
  id: string;
  status: string;
  occurrence_number: number;
  price_snapshot: number;
  created_at: string;
  participant_id: string;
  challenge_id: string;
  goal_id: string;
  offer_id: string;
};

type RegistrationStatus =
  "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "EXPIRED";

const statusLabels: Record<RegistrationStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

export function RegistrationsPanel({ supabase, canManage }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerGoals, setOfferGoals] = useState<OfferGoal[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [participantId, setParticipantId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const [p, c, g, o, og, r] = await Promise.all([
      supabase
        .from("participants")
        .select("id,full_name")
        .eq("status", "ACTIVE")
        .order("full_name"),
      supabase
        .from("challenges")
        .select("id,public_name")
        .order("sports_starts_at", { ascending: false }),
      supabase
        .from("challenge_goals")
        .select("id,challenge_id,public_label,target_km")
        .eq("is_active", true),
      supabase
        .from("challenge_offers")
        .select("id,challenge_id,public_name,status")
        .order("registration_starts_at", { ascending: false }),
      supabase.from("challenge_offer_goals").select("offer_id,goal_id"),
      supabase
        .from("registrations")
        .select(
          "id,status,occurrence_number,price_snapshot,created_at,participant_id,challenge_id,goal_id,offer_id",
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if ([p, c, g, o, og, r].some((result) => result.error)) {
      setMessage(
        "Não foi possível carregar todas as informações de inscrições.",
      );
    } else {
      setParticipants((p.data ?? []) as Participant[]);
      setChallenges((c.data ?? []) as Challenge[]);
      setGoals((g.data ?? []) as Goal[]);
      setOffers((o.data ?? []) as Offer[]);
      setOfferGoals((og.data ?? []) as OfferGoal[]);
      setRegistrations((r.data ?? []) as Registration[]);
      setMessage(
        r.data?.length
          ? `${r.data.length} inscrições mais recentes.`
          : "Nenhuma inscrição cadastrada ainda.",
      );
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const challengeOffers = useMemo(
    () => offers.filter((offer) => offer.challenge_id === challengeId),
    [offers, challengeId],
  );

  const allowedGoalIds = useMemo(
    () =>
      new Set(
        offerGoals
          .filter((item) => item.offer_id === offerId)
          .map((item) => item.goal_id),
      ),
    [offerGoals, offerId],
  );

  const allowedGoals = useMemo(
    () =>
      goals.filter(
        (goal) =>
          goal.challenge_id === challengeId && allowedGoalIds.has(goal.id),
      ),
    [goals, challengeId, allowedGoalIds],
  );

  async function createRegistration(event: React.FormEvent) {
    event.preventDefault();
    if (!participantId || !challengeId || !offerId || !goalId) {
      setMessage("Selecione participante, desafio, oferta e meta.");
      return;
    }

    const occurrence =
      registrations.filter(
        (item) =>
          item.participant_id === participantId && item.offer_id === offerId,
      ).length + 1;

    setBusy(true);
    const { error } = await supabase.from("registrations").insert({
      participant_id: participantId,
      challenge_id: challengeId,
      offer_id: offerId,
      goal_id: goalId,
      occurrence_number: occurrence,
      price_snapshot: 0,
      source_code: "ADMIN",
    });

    if (error) {
      setMessage(
        error.message.includes("limit")
          ? "Este participante atingiu o limite permitido para esta oferta."
          : "Não foi possível criar a inscrição agora.",
      );
    } else {
      setMessage("Inscrição criada em situação pendente.");
      setParticipantId("");
      setChallengeId("");
      setOfferId("");
      setGoalId("");
      await load();
    }
    setBusy(false);
  }

  async function updateStatus(id: string, status: RegistrationStatus) {
    setBusy(true);
    const { error } = await supabase
      .from("registrations")
      .update({ status })
      .eq("id", id);

    if (error) {
      setMessage("A mudança de situação não é permitida para esta inscrição.");
    } else {
      setMessage(`Inscrição atualizada para ${statusLabels[status]}.`);
      await load();
    }
    setBusy(false);
  }

  function nameOfParticipant(id: string) {
    return (
      participants.find((item) => item.id === id)?.full_name ?? "Participante"
    );
  }

  function nameOfChallenge(id: string) {
    return challenges.find((item) => item.id === id)?.public_name ?? "Desafio";
  }

  function lifecycleActions(registration: Registration) {
    if (!canManage) return null;

    if (registration.status === "PENDING") {
      return (
        <div className="registration-actions">
          <button
            type="button"
            className="compact"
            disabled={busy}
            onClick={() => void updateStatus(registration.id, "CONFIRMED")}
          >
            Confirmar
          </button>
          <button
            type="button"
            className="compact secondary"
            disabled={busy}
            onClick={() => void updateStatus(registration.id, "CANCELLED")}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="compact secondary"
            disabled={busy}
            onClick={() => void updateStatus(registration.id, "EXPIRED")}
          >
            Expirar
          </button>
        </div>
      );
    }

    if (registration.status === "CONFIRMED") {
      return (
        <div className="registration-actions">
          <button
            type="button"
            className="compact"
            disabled={busy}
            onClick={() => void updateStatus(registration.id, "COMPLETED")}
          >
            Concluir
          </button>
          <button
            type="button"
            className="compact secondary"
            disabled={busy}
            onClick={() => void updateStatus(registration.id, "CANCELLED")}
          >
            Cancelar
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <section className="audit-panel" aria-labelledby="registrations-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operação</p>
          <h2 id="registrations-title">Inscrições</h2>
        </div>
        <button
          type="button"
          className="compact"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Carregando…" : "Atualizar"}
        </button>
      </div>
      <p className="section-description">
        Vínculo entre participante, desafio, oferta e meta. Pagamento e estoque
        entram em ciclos próprios.
      </p>
      <p role="status" className="status">
        {message}
      </p>

      {canManage ? (
        <form onSubmit={createRegistration}>
          <label>
            Participante
            <select
              value={participantId}
              onChange={(event) => setParticipantId(event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desafio
            <select
              value={challengeId}
              onChange={(event) => {
                setChallengeId(event.target.value);
                setOfferId("");
                setGoalId("");
              }}
              required
            >
              <option value="">Selecione</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {challenge.public_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Oferta
            <select
              value={offerId}
              onChange={(event) => {
                setOfferId(event.target.value);
                setGoalId("");
              }}
              required
              disabled={!challengeId}
            >
              <option value="">Selecione</option>
              {challengeOffers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.public_name} · {offer.status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Meta
            <select
              value={goalId}
              onChange={(event) => setGoalId(event.target.value)}
              required
              disabled={!offerId}
            >
              <option value="">Selecione</option>
              {allowedGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.public_label ?? `${goal.target_km} km`}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            Criar inscrição pendente
          </button>
        </form>
      ) : null}

      {registrations.length > 0 ? (
        <div className="audit-list">
          {registrations.map((registration) => (
            <article className="audit-item" key={registration.id}>
              <div>
                <strong>
                  {nameOfParticipant(registration.participant_id)}
                </strong>
                <span>{nameOfChallenge(registration.challenge_id)}</span>
              </div>
              <div className="audit-meta">
                <span>
                  {statusLabels[registration.status as RegistrationStatus] ??
                    registration.status}
                </span>
                <span>
                  R${" "}
                  {Number(registration.price_snapshot)
                    .toFixed(2)
                    .replace(".", ",")}
                </span>
                {lifecycleActions(registration)}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
