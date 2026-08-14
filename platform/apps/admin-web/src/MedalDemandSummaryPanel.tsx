import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
};

type DemandRow = {
  challenge_id: string;
  challenge_name: string;
  goal_id: string;
  target_km: number;
  goal_label: string;
  confirmed_count: number;
  reserved_registration_count: number;
  confirmed_without_reservation_count: number;
  physical_balance: number;
  reserved_quantity: number;
  available_balance: number;
  minimum_additional_medals_needed: number;
};

export function MedalDemandSummaryPanel({ supabase }: Props) {
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("medal_inventory_demand_summary")
      .select(
        "challenge_id,challenge_name,goal_id,target_km,goal_label,confirmed_count,reserved_registration_count,confirmed_without_reservation_count,physical_balance,reserved_quantity,available_balance,minimum_additional_medals_needed",
      )
      .order("challenge_name")
      .order("target_km");

    if (error) {
      setMessage("Não foi possível carregar a demanda de medalhas.");
    } else {
      setRows((data ?? []) as DemandRow[]);
      setMessage(
        data?.length
          ? "Demanda calculada a partir das inscrições confirmadas e do estoque atual."
          : "Ainda não há demanda de medalhas para exibir.",
      );
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (accumulator, row) => {
          accumulator.confirmed += Number(row.confirmed_count);
          accumulator.unallocated += Number(
            row.confirmed_without_reservation_count,
          );
          accumulator.physical += Number(row.physical_balance);
          accumulator.available += Number(row.available_balance);
          accumulator.need += Number(row.minimum_additional_medals_needed);
          return accumulator;
        },
        { confirmed: 0, unallocated: 0, physical: 0, available: 0, need: 0 },
      ),
    [rows],
  );

  return (
    <section className="audit-panel" aria-labelledby="medal-demand-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Planejamento</p>
          <h2 id="medal-demand-title">Demanda de medalhas</h2>
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
        Use este resumo para preparar o pedido de medalhas. Ele considera apenas
        inscrições confirmadas e compara a demanda com o estoque físico e as
        reservas já existentes.
      </p>
      <p role="status" className="status">
        {message}
      </p>

      {rows.length > 0 ? (
        <>
          <div className="operations-summary" aria-label="Resumo da demanda">
            <div className="summary-card">
              <span>Inscrições confirmadas</span>
              <strong>{totals.confirmed}</strong>
            </div>
            <div className="summary-card">
              <span>Sem reserva física</span>
              <strong>{totals.unallocated}</strong>
            </div>
            <div className="summary-card">
              <span>Estoque físico</span>
              <strong>{totals.physical}</strong>
            </div>
            <div className="summary-card">
              <span>Disponível</span>
              <strong>{totals.available}</strong>
            </div>
            <div className="summary-card">
              <span>Mínimo a pedir</span>
              <strong>{totals.need}</strong>
            </div>
          </div>

          <div className="audit-list">
            {rows.map((row) => (
              <article className="audit-item" key={`${row.challenge_id}:${row.goal_id}`}>
                <div>
                  <strong>{row.goal_label}</strong>
                  <span>{row.challenge_name}</span>
                  <span>
                    Confirmadas: {row.confirmed_count} · já reservadas: {row.reserved_registration_count}
                  </span>
                </div>
                <div className="audit-meta">
                  <span>Sem reserva: {row.confirmed_without_reservation_count}</span>
                  <span>Físico: {row.physical_balance}</span>
                  <span>Disponível: {row.available_balance}</span>
                  <span>
                    Mínimo adicional: {row.minimum_additional_medals_needed}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
