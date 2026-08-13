import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { ReservationStatusNote } from "./ReservationStatusNote";
import "./operations-summary.css";

type Props = { supabase: SupabaseClient };

type PaymentSummary = "PAID" | "PARTIAL" | "PENDING" | "UNPAID";

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
  payment_summary: PaymentSummary;
  created_at: string;
  reservation_status: string | null;
  inventory_item_id: string | null;
  avatar_acceptance_ready: boolean;
};

const paymentLabels: Record<PaymentSummary, string> = {
  PAID: "Pago",
  PARTIAL: "Parcial",
  PENDING: "Pagamento pendente",
  UNPAID: "Sem pagamento",
};

export function OperationsPanel({ supabase }: Props) {
  const [rows, setRows] = useState<OperationRow[]>([]);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentSummary | "ALL">(
    "ALL",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("registration_operations_overview")
      .select(
        "registration_id,participant_name,challenge_name,goal_name,offer_name,registration_status,price_snapshot,confirmed_amount,pending_amount,payment_summary,created_at,reservation_status,inventory_item_id,avatar_acceptance_ready",
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

  const summary = useMemo(() => {
    const initial: Record<PaymentSummary, number> = {
      PAID: 0,
      PARTIAL: 0,
      PENDING: 0,
      UNPAID: 0,
    };

    return rows.reduce((accumulator, row) => {
      accumulator[row.payment_summary] += 1;
      return accumulator;
    }, initial);
  }, [rows]);

  const reservedCount = useMemo(
    () => rows.filter((row) => row.reservation_status === "RESERVED").length,
    [rows],
  );

  const avatarReadyCount = useMemo(
    () => rows.filter((row) => row.avatar_acceptance_ready).length,
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => {
      const matchesPayment =
        paymentFilter === "ALL" || row.payment_summary === paymentFilter;
      const matchesQuery =
        !normalized ||
        [
          row.participant_name,
          row.challenge_name,
          row.goal_name,
          row.offer_name,
          row.registration_status,
          row.reservation_status ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return matchesPayment && matchesQuery;
    });
  }, [paymentFilter, query, rows]);

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
        Leitura consolidada de inscrição, pagamento e reserva de medalha. Esta
        tela não altera estados nem movimenta estoque.
      </p>

      <div
        className="operations-summary"
        aria-label="Resumo financeiro das inscrições"
      >
        <button
          type="button"
          className={
            paymentFilter === "ALL" ? "summary-card selected" : "summary-card"
          }
          onClick={() => setPaymentFilter("ALL")}
        >
          <span>Total</span>
          <strong>{rows.length}</strong>
        </button>
        {(Object.keys(paymentLabels) as PaymentSummary[]).map((key) => (
          <button
            type="button"
            className={
              paymentFilter === key ? "summary-card selected" : "summary-card"
            }
            key={key}
            onClick={() => setPaymentFilter(key)}
          >
            <span>{paymentLabels[key]}</span>
            <strong>{summary[key]}</strong>
          </button>
        ))}
      </div>

      <div className="operations-summary" aria-label="Resumo de reservas">
        <div className="summary-card static-card">
          <span>Medalhas reservadas</span>
          <strong>{reservedCount}</strong>
        </div>
        <div className="summary-card static-card">
          <span>Avatares liberados</span>
          <strong>{avatarReadyCount}</strong>
        </div>
      </div>

      <label>
        Buscar
        <input
          type="search"
          value={query}
          placeholder="Participante, desafio, meta, oferta ou situação"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p role="status" className="status">
        {message}
        {rows.length > 0 && filteredRows.length !== rows.length
          ? ` Exibindo ${filteredRows.length} após os filtros.`
          : ""}
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
                <span>{paymentLabels[row.payment_summary]}</span>
                <ReservationStatusNote
                  reservationStatus={row.reservation_status}
                  avatarAcceptanceReady={row.avatar_acceptance_ready}
                />
                <span>
                  R$ {Number(row.confirmed_amount).toFixed(2).replace(".", ",")}{" "}
                  / R$ {Number(row.price_snapshot).toFixed(2).replace(".", ",")}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : rows.length > 0 ? (
        <p className="empty-note">
          Nenhuma inscrição corresponde aos filtros atuais.
        </p>
      ) : null}
    </section>
  );
}
