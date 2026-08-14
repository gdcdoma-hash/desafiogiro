import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type PlanningRow = {
  challenge_id: string;
  challenge_name: string;
  goal_id: string;
  goal_label: string;
  confirmed_count: number;
  confirmed_without_reservation_count: number;
  available_balance: number;
  minimum_additional_medals_needed: number;
  open_order_quantity: number;
  suggested_purchase_quantity: number;
};

type Props = {
  supabase: SupabaseClient;
};

export function MedalPurchasePlanningPanel({ supabase }: Props) {
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("medal_purchase_planning")
        .select("*")
        .order("challenge_name")
        .order("goal_label");

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setRows([]);
      } else {
        setRows((data ?? []) as PlanningRow[]);
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          confirmed: acc.confirmed + row.confirmed_count,
          uncovered: acc.uncovered + row.confirmed_without_reservation_count,
          ordered: acc.ordered + row.open_order_quantity,
          suggested: acc.suggested + row.suggested_purchase_quantity,
        }),
        { confirmed: 0, uncovered: 0, ordered: 0, suggested: 0 },
      ),
    [rows],
  );

  return (
    <section className="panel-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Planejamento de compra</p>
          <h2>Necessidade de medalhas</h2>
          <p className="muted">
            Compara inscrições confirmadas, estoque disponível e pedidos já abertos para evitar compra duplicada.
          </p>
        </div>
      </div>

      {loading ? <p className="muted">Carregando planejamento...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Confirmadas</span>
              <strong>{totals.confirmed}</strong>
            </div>
            <div className="stat-card">
              <span>Sem reserva física</span>
              <strong>{totals.uncovered}</strong>
            </div>
            <div className="stat-card">
              <span>Já cobertas por pedidos</span>
              <strong>{totals.ordered}</strong>
            </div>
            <div className="stat-card">
              <span>Sugestão adicional</span>
              <strong>{totals.suggested}</strong>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="muted">Ainda não há dados suficientes para calcular compras.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Desafio</th>
                    <th>Meta</th>
                    <th>Confirmadas</th>
                    <th>Disponível</th>
                    <th>Necessidade mínima</th>
                    <th>Em pedidos</th>
                    <th>Sugestão de compra</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.challenge_id}:${row.goal_id}`}>
                      <td>{row.challenge_name}</td>
                      <td>{row.goal_label}</td>
                      <td>{row.confirmed_count}</td>
                      <td>{row.available_balance}</td>
                      <td>{row.minimum_additional_medals_needed}</td>
                      <td>{row.open_order_quantity}</td>
                      <td>
                        <strong>{row.suggested_purchase_quantity}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
