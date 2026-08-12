import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = { supabase: SupabaseClient };

type OperationRow = {
  registration_id: string;
  participant_name: string;
  challenge_name: string;
  goal_name: string;
  offer_name: string;
  registration_status: string;
  price_snapshot: number;
  confirmed_amount: number;
  pending_amount: number;
  payment_summary: "PAID" | "PARTIAL" | "PENDING" | "UNPAID";
  created_at: string;
};

const paymentLabels: Record<OperationRow["payment_summary"], string> = {
  PAID: "Pago",
  PARTIAL: "Parcial",
  PENDING: "Pagamento pendente",
  UNPAID: "Sem pagamento",
};

export function OperationsPanel({ supabase }: Props) {
  const [rows, setRows] = useState<OperationRow[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("registration_operations_overview")
      .select(
        "registration_id,participant_name,challenge_name,goal_name,offer_name,registration_status,price_snapshot,confirmed_amount,pending_amount,payment_summary,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setRows([]);
      setMessage("Não foi possível carregar a visão operacional agora.");
    } else {
      setRows((data ?? []) as OperationRow[]);
      setMessage(
        data?.length
          ? `${data.length} inscrições mais recentes consolidadas.`
          : "Nenhuma inscrição disponível para acompanhamento.",
      );
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return rows;
    return rows.filter((row) =>
      [row.participant_name, row.challenge_name, row.goal_name, row.offer_name]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    );
  }, [query, rows]);

  return (
    <section className="audit-panel" aria-labelledby="operations-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operação</p>
          <h2 id="operations-title">Visão operacional</h2>
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
        Leitura consolidada de inscrição e pagamento. Esta tela não altera
        estados nem movimenta estoque.
      </p>
      <label>
        Buscar
        <input
          type="search"
          value={query}
          placeholder="Participante, desafio, meta ou oferta"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p role="status" className="status">
        {message}
      </p>

      {filteredRows.length > 0 ? (
        <div className="audit-list">
          {filteredRows.map((row) => (
            <article className="audit-item" key={row.registration_id}>
              <div>
                <strong>{row.participant_name}</strong>
                <span>
                  {row.challenge_name} · {row.goal_name} · {row.offer_name}
                </span>
              </div>
              <div className="audit-meta">
                <span>{row.registration_status}</span>
                <span>
                  {paymentLabels[row.payment_summary] ?? row.payment_summary}
                </span>
                <span>
                  R$ {Number(row.confirmed_amount).toFixed(2).replace(".", ",")}{" "}
                  / R$ {Number(row.price_snapshot).toFixed(2).replace(".", ",")}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
