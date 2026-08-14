import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

type DemandRow = {
  challenge_id: string;
  challenge_name: string;
  confirmed_without_reservation_count: number;
  available_balance: number;
};

type ChallengeSummary = {
  challengeId: string;
  challengeName: string;
  withoutReservation: number;
  available: number;
};

export function InventoryReservationReconciliationPanel({
  supabase,
  canManage,
}: Props) {
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [message, setMessage] = useState("");
  const [busyChallengeId, setBusyChallengeId] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("medal_inventory_demand_summary")
      .select(
        "challenge_id,challenge_name,confirmed_without_reservation_count,available_balance",
      )
      .order("challenge_name");

    if (error) {
      setMessage("Não foi possível carregar as pendências de reserva.");
      return;
    }

    setRows((data ?? []) as DemandRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  const challenges = useMemo(() => {
    const grouped = new Map<string, ChallengeSummary>();

    for (const row of rows) {
      const current = grouped.get(row.challenge_id) ?? {
        challengeId: row.challenge_id,
        challengeName: row.challenge_name,
        withoutReservation: 0,
        available: 0,
      };

      current.withoutReservation += Number(
        row.confirmed_without_reservation_count,
      );
      current.available += Number(row.available_balance);
      grouped.set(row.challenge_id, current);
    }

    return [...grouped.values()].filter(
      (challenge) => challenge.withoutReservation > 0,
    );
  }, [rows]);

  async function reconcile(challenge: ChallengeSummary) {
    setBusyChallengeId(challenge.challengeId);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "reconcile_confirmed_inventory_reservations",
      { target_challenge_id: challenge.challengeId },
    );

    if (error) {
      setMessage("Não foi possível reconciliar as reservas agora.");
      setBusyChallengeId(null);
      return;
    }

    const count = Number(data ?? 0);
    setMessage(
      count > 0
        ? `${count} reserva(s) criada(s) para ${challenge.challengeName}.`
        : `Nenhuma nova reserva foi criada para ${challenge.challengeName}. Verifique o estoque disponível por meta.`,
    );
    await load();
    setBusyChallengeId(null);
  }

  if (!challenges.length && !message) return null;

  return (
    <section
      className="audit-panel"
      aria-labelledby="reservation-reconciliation-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Estoque</p>
          <h2 id="reservation-reconciliation-title">Reservas pendentes</h2>
        </div>
      </div>
      <p className="section-description">
        Inscrições pagas podem existir antes da entrada física das medalhas.
        Quando houver saldo disponível, use a reconciliação para vincular as
        medalhas às inscrições confirmadas sem alterar o status financeiro.
      </p>
      {message ? (
        <p role="status" className="status">
          {message}
        </p>
      ) : null}
      {challenges.length ? (
        <div className="audit-list">
          {challenges.map((challenge) => (
            <article className="audit-item" key={challenge.challengeId}>
              <div>
                <strong>{challenge.challengeName}</strong>
                <span>
                  {challenge.withoutReservation} inscrição(ões) confirmada(s)
                  sem reserva física
                </span>
                <span>
                  {challenge.available} medalha(s) disponível(is) no total
                </span>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="compact"
                  disabled={busyChallengeId === challenge.challengeId}
                  onClick={() => void reconcile(challenge)}
                >
                  {busyChallengeId === challenge.challengeId
                    ? "Reconciliando…"
                    : "Reconciliar reservas"}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
