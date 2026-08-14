import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
};

type CitySummary = {
  challenge_id: string;
  challenge_name: string;
  city: string;
  state_code: string | null;
  total_deliveries: number;
  pending_count: number;
  assigned_count: number;
  awaiting_receipt_count: number;
  issue_count: number;
  confirmed_count: number;
  cancelled_count: number;
  batch_count: number;
};

type AttentionRow = {
  id: string;
  participant_name: string;
  participant_city: string;
  participant_state_code: string | null;
  challenge_name: string;
  target_km: number;
  status: string;
  batch_label: string | null;
  attention_reason:
    "ISSUE" | "OVERDUE_PERIOD" | "AWAITING_7_DAYS" | "PENDING" | "NORMAL";
  attention_priority: number;
  days_since_handoff: number | null;
};

const reasonLabels: Record<AttentionRow["attention_reason"], string> = {
  ISSUE: "Problema informado",
  OVERDUE_PERIOD: "Período de entrega vencido",
  AWAITING_7_DAYS: "Confirmação pendente há mais de 7 dias",
  PENDING: "Medalha ainda não preparada",
  NORMAL: "Acompanhamento normal",
};

export function MedalDeliveryVisibilityPanel({ supabase }: Props) {
  const [summaries, setSummaries] = useState<CitySummary[]>([]);
  const [attentionRows, setAttentionRows] = useState<AttentionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    const [summaryResult, attentionResult] = await Promise.all([
      supabase
        .from("medal_delivery_city_summary")
        .select(
          "challenge_id,challenge_name,city,state_code,total_deliveries,pending_count,assigned_count,awaiting_receipt_count,issue_count,confirmed_count,cancelled_count,batch_count",
        )
        .order("challenge_name", { ascending: true })
        .order("state_code", { ascending: true })
        .order("city", { ascending: true }),
      supabase
        .from("medal_delivery_attention")
        .select(
          "id,participant_name,participant_city,participant_state_code,challenge_name,target_km,status,batch_label,attention_reason,attention_priority,days_since_handoff",
        )
        .neq("attention_reason", "NORMAL")
        .order("attention_priority", { ascending: true })
        .order("participant_name", { ascending: true }),
    ]);

    if (summaryResult.error || attentionResult.error) {
      setMessage("Não foi possível carregar a visão operacional das entregas.");
      if (summaryResult.error) setSummaries([]);
      if (attentionResult.error) setAttentionRows([]);
    } else {
      setSummaries((summaryResult.data ?? []) as CitySummary[]);
      setAttentionRows((attentionResult.data ?? []) as AttentionRow[]);
      setMessage("Visão operacional atualizada.");
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(
    () => ({
      cities: summaries.length,
      deliveries: summaries.reduce(
        (total, row) => total + row.total_deliveries,
        0,
      ),
      pending: summaries.reduce((total, row) => total + row.pending_count, 0),
      awaiting: summaries.reduce(
        (total, row) => total + row.awaiting_receipt_count,
        0,
      ),
      issues: summaries.reduce((total, row) => total + row.issue_count, 0),
      confirmed: summaries.reduce(
        (total, row) => total + row.confirmed_count,
        0,
      ),
    }),
    [summaries],
  );

  return (
    <section className="audit-panel" aria-labelledby="medal-visibility-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Acompanhamento</p>
          <h2 id="medal-visibility-title">Visão operacional das entregas</h2>
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
        Consolida cidades e destaca automaticamente as entregas que precisam de
        ação da equipe.
      </p>
      <p role="status" className="status">
        {message}
      </p>

      <div className="audit-list" aria-label="Resumo geral das entregas">
        <article className="audit-item">
          <div>
            <strong>{totals.deliveries}</strong>
            <span>Medalhas acompanhadas em {totals.cities} cidade(s)</span>
          </div>
        </article>
        <article className="audit-item">
          <div>
            <strong>{totals.pending}</strong>
            <span>Ainda não preparadas</span>
          </div>
        </article>
        <article className="audit-item">
          <div>
            <strong>{totals.awaiting}</strong>
            <span>Aguardando recebimento</span>
          </div>
        </article>
        <article className="audit-item">
          <div>
            <strong>{totals.issues}</strong>
            <span>Com problema informado</span>
          </div>
        </article>
        <article className="audit-item">
          <div>
            <strong>{totals.confirmed}</strong>
            <span>Recebimentos confirmados</span>
          </div>
        </article>
      </div>

      <h3>Prioridades da equipe</h3>
      {attentionRows.length ? (
        <div className="audit-list">
          {attentionRows.map((row) => (
            <article className="audit-item" key={row.id}>
              <div>
                <strong>{row.participant_name}</strong>
                <span>
                  {[row.participant_city, row.participant_state_code]
                    .filter(Boolean)
                    .join(" - ")}{" "}
                  · {row.challenge_name} · {row.target_km} km
                </span>
                <span>{reasonLabels[row.attention_reason]}</span>
                {row.batch_label ? <span>Lote: {row.batch_label}</span> : null}
              </div>
              <div className="audit-meta">
                <span>Prioridade {row.attention_priority}</span>
                {row.days_since_handoff !== null ? (
                  <span>{row.days_since_handoff} dia(s) desde o repasse</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="status">Nenhuma entrega exige atenção especial agora.</p>
      )}

      <h3>Resumo por cidade</h3>
      {summaries.length ? (
        <div className="audit-list">
          {summaries.map((row) => (
            <article
              className="audit-item"
              key={`${row.challenge_id}-${row.city}-${row.state_code ?? ""}`}
            >
              <div>
                <strong>
                  {row.city || "Cidade não informada"}
                  {row.state_code ? ` - ${row.state_code}` : ""}
                </strong>
                <span>{row.challenge_name}</span>
                <span>
                  Total {row.total_deliveries} · pendentes {row.pending_count} ·
                  em lote {row.assigned_count} · aguardando recebimento{" "}
                  {row.awaiting_receipt_count}
                </span>
                <span>
                  Problemas {row.issue_count} · confirmadas{" "}
                  {row.confirmed_count}· lotes {row.batch_count}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="status">Ainda não há cidades para consolidar.</p>
      )}
    </section>
  );
}
