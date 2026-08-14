import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

type BatchReconciliation = {
  batch_id: string;
  challenge_id: string;
  label: string;
  method: string;
  city: string;
  state_code: string | null;
  status: string;
  handed_over_at: string | null;
  total_deliveries: number;
  confirmed_count: number;
  cancelled_count: number;
  issue_count: number;
  open_count: number;
  ready_to_close: boolean;
};

export function MedalDeliveryBatchReconciliationPanel({ supabase, canManage }: Props) {
  const [rows, setRows] = useState<BatchReconciliation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("medal_delivery_batch_reconciliation")
      .select("*")
      .order("handed_over_at", { ascending: false, nullsFirst: false });

    if (error) {
      setMessage("Não foi possível carregar a conciliação dos lotes.");
      return;
    }

    setRows((data ?? []) as BatchReconciliation[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function closeBatch(batchId: string) {
    setBusyId(batchId);
    setMessage("");

    const { error } = await supabase.rpc("close_medal_delivery_batch", {
      target_batch_id: batchId,
    });

    if (error) {
      setMessage("O lote ainda não pode ser encerrado ou ocorreu um erro no fechamento.");
    } else {
      setMessage("Lote encerrado com sucesso.");
      await load();
    }

    setBusyId(null);
  }

  if (rows.length === 0) return null;

  return (
    <section className="audit-panel" aria-labelledby="medal-delivery-reconciliation-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Conciliação</p>
          <h2 id="medal-delivery-reconciliation-title">Fechamento dos lotes</h2>
        </div>
        <button type="button" className="compact" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <p className="section-description">
        Confira se todas as medalhas do lote foram confirmadas ou canceladas antes de encerrar a entrega.
      </p>
      <p className="status" role="status">{message}</p>

      <div className="audit-list">
        {rows.map((row) => (
          <article className="audit-item" key={row.batch_id}>
            <div>
              <strong>{row.label}</strong>
              <span>
                {row.city || "Sem cidade definida"}
                {row.state_code ? ` - ${row.state_code}` : ""} · {row.method}
              </span>
              <span>
                Total {row.total_deliveries} · Confirmadas {row.confirmed_count} · Canceladas {row.cancelled_count} · Problemas {row.issue_count} · Em aberto {row.open_count}
              </span>
              <span>
                {row.status === "CLOSED"
                  ? "Lote encerrado"
                  : row.ready_to_close
                    ? "Pronto para encerramento"
                    : "Ainda há entregas pendentes"}
              </span>
              {canManage && row.status === "HANDED_OFF" ? (
                <button
                  type="button"
                  disabled={!row.ready_to_close || busyId === row.batch_id}
                  onClick={() => void closeBatch(row.batch_id)}
                >
                  {busyId === row.batch_id ? "Encerrando..." : "Encerrar lote"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
