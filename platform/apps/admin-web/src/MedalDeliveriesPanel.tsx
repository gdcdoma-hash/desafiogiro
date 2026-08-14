import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = { supabase: SupabaseClient };

type DeliveryStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_TRANSIT"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "ISSUE_REPORTED"
  | "CANCELLED";

type DeliveryRow = {
  id: string;
  status: DeliveryStatus;
  participant_name: string;
  participant_city: string;
  participant_state_code: string | null;
  challenge_name: string;
  target_km: number;
  batch_label: string | null;
  delivery_method: string | null;
  batch_responsible_name: string | null;
  tracking_code: string;
  handoff_recipient_name: string;
  handed_off_at: string | null;
  athlete_confirmed_at: string | null;
  issue_note: string;
  needs_attention: boolean;
};

type Filter = "ALL" | DeliveryStatus;

const statusLabels: Record<DeliveryStatus, string> = {
  PENDING: "Pendente",
  ASSIGNED: "Separada em lote",
  IN_TRANSIT: "Em trânsito",
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Recebimento confirmado",
  ISSUE_REPORTED: "Problema informado",
  CANCELLED: "Cancelada",
};

const methodLabels: Record<string, string> = {
  EVENT: "Evento",
  STORE_PICKUP: "Retirada na loja",
  POSTAL: "Correios",
  OTHER: "Outro",
};

export function MedalDeliveriesPanel({ supabase }: Props) {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("medal_delivery_overview")
      .select(
        "id,status,participant_name,participant_city,participant_state_code,challenge_name,target_km,batch_label,delivery_method,batch_responsible_name,tracking_code,handoff_recipient_name,handed_off_at,athlete_confirmed_at,issue_note,needs_attention",
      )
      .order("needs_attention", { ascending: false })
      .order("participant_name", { ascending: true });

    if (error) {
      setRows([]);
      setMessage("Não foi possível carregar as entregas de medalhas agora.");
    } else {
      setRows((data ?? []) as DeliveryRow[]);
      setMessage(
        data?.length
          ? `${data.length} entrega(s) acompanhada(s).`
          : "Nenhuma entrega de medalha foi iniciada.",
      );
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const counters = useMemo(() => {
    const count = (status: DeliveryStatus) =>
      rows.filter((row) => row.status === status).length;
    return {
      pending: count("PENDING"),
      awaiting: count("AWAITING_CONFIRMATION"),
      issues: count("ISSUE_REPORTED"),
      confirmed: count("CONFIRMED"),
    };
  }, [rows]);

  const visibleRows = useMemo(
    () =>
      filter === "ALL" ? rows : rows.filter((row) => row.status === filter),
    [filter, rows],
  );

  function location(row: DeliveryRow) {
    return [row.participant_city, row.participant_state_code]
      .filter(Boolean)
      .join(" - ");
  }

  return (
    <section className="audit-panel" aria-labelledby="medal-deliveries-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Logística</p>
          <h2 id="medal-deliveries-title">Entrega de medalhas</h2>
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
        Controle do repasse da medalha até a confirmação final de recebimento
        pelo atleta.
      </p>
      <div className="audit-list" aria-label="Resumo de entregas">
        <article className="audit-item">
          <div>
            <strong>{counters.pending}</strong>
            <span>Pendentes de preparação</span>
          </div>
        </article>
        <article className="audit-item">
          <div>
            <strong>{counters.awaiting}</strong>
            <span>Aguardando confirmação do atleta</span>
          </div>
        </article>
        <article className="audit-item">
          <div>
            <strong>{counters.issues}</strong>
            <span>Problemas informados</span>
          </div>
        </article>
        <article className="audit-item">
          <div>
            <strong>{counters.confirmed}</strong>
            <span>Recebimentos confirmados</span>
          </div>
        </article>
      </div>
      <label>
        Situação
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
        >
          <option value="ALL">Todas</option>
          <option value="PENDING">Pendentes</option>
          <option value="ASSIGNED">Separadas em lote</option>
          <option value="IN_TRANSIT">Em trânsito</option>
          <option value="AWAITING_CONFIRMATION">Aguardando confirmação</option>
          <option value="ISSUE_REPORTED">Com problema</option>
          <option value="CONFIRMED">Confirmadas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </label>
      <p role="status" className="status">
        {message}
      </p>
      {visibleRows.length ? (
        <div className="audit-list">
          {visibleRows.map((row) => (
            <article className="audit-item" key={row.id}>
              <div>
                <strong>{row.participant_name}</strong>
                <span>
                  {location(row)} · {row.challenge_name} · {row.target_km} km
                </span>
                <span>{statusLabels[row.status]}</span>
                {row.batch_label ? (
                  <span>
                    {methodLabels[row.delivery_method ?? ""] ??
                      row.delivery_method}{" "}
                    · {row.batch_label}
                    {row.batch_responsible_name
                      ? ` · responsável: ${row.batch_responsible_name}`
                      : ""}
                  </span>
                ) : null}
                {row.handoff_recipient_name ? (
                  <span>Repasse: {row.handoff_recipient_name}</span>
                ) : null}
                {row.tracking_code ? (
                  <span>Rastreio: {row.tracking_code}</span>
                ) : null}
                {row.issue_note ? (
                  <span>Ocorrência: {row.issue_note}</span>
                ) : null}
              </div>
              <div className="audit-meta">
                {row.needs_attention ? <span>Atenção</span> : null}
                {row.athlete_confirmed_at ? <span>Confirmada</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
