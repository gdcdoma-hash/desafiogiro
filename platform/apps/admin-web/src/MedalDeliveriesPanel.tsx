import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

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

type Challenge = {
  id: string;
  public_name: string;
  reference_year: number;
  reference_month: number;
};

type DeliveryPeriod = {
  id: string;
  challenge_id: string;
  starts_at: string;
  ends_at: string;
  status: "PLANNED" | "OPEN" | "CLOSED" | "CANCELLED";
  notes: string;
};

type DeliveryBatch = {
  id: string;
  method: "EVENT" | "STORE_PICKUP" | "POSTAL" | "OTHER";
  label: string;
  city: string;
  state_code: string | null;
  responsible_name: string;
  status: "PREPARING" | "HANDED_OFF" | "CLOSED" | "CANCELLED";
};

type Filter = "ALL" | DeliveryStatus;

type BatchMethod = DeliveryBatch["method"];

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

const periodStatusLabels: Record<DeliveryPeriod["status"], string> = {
  PLANNED: "Planejado",
  OPEN: "Aberto",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
};

function toIso(localValue: string) {
  return new Date(localValue).toISOString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MedalDeliveriesPanel({ supabase, canManage }: Props) {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [period, setPeriod] = useState<DeliveryPeriod | null>(null);
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [periodStartsAt, setPeriodStartsAt] = useState("");
  const [periodEndsAt, setPeriodEndsAt] = useState("");
  const [periodNotes, setPeriodNotes] = useState("");
  const [batchMethod, setBatchMethod] = useState<BatchMethod>("EVENT");
  const [batchLabel, setBatchLabel] = useState("");
  const [batchCity, setBatchCity] = useState("");
  const [batchState, setBatchState] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");

  async function load() {
    setBusy(true);
    const [{ data, error }, challengeResult] = await Promise.all([
      supabase
        .from("medal_delivery_overview")
        .select(
          "id,status,participant_name,participant_city,participant_state_code,challenge_name,target_km,batch_label,delivery_method,batch_responsible_name,tracking_code,handoff_recipient_name,handed_off_at,athlete_confirmed_at,issue_note,needs_attention",
        )
        .order("needs_attention", { ascending: false })
        .order("participant_name", { ascending: true }),
      supabase
        .from("challenges")
        .select("id,public_name,reference_year,reference_month")
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false }),
    ]);

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

    if (!challengeResult.error) {
      const nextChallenges = (challengeResult.data ?? []) as Challenge[];
      setChallenges(nextChallenges);
      setChallengeId((current) => current || nextChallenges[0]?.id || "");
    }
    setBusy(false);
  }

  async function loadManagement(targetChallengeId: string) {
    if (!targetChallengeId) {
      setPeriod(null);
      setBatches([]);
      return;
    }
    const [periodResult, batchResult] = await Promise.all([
      supabase
        .from("medal_delivery_periods")
        .select("id,challenge_id,starts_at,ends_at,status,notes")
        .eq("challenge_id", targetChallengeId)
        .maybeSingle(),
      supabase
        .from("medal_delivery_batches")
        .select(
          "id,method,label,city,state_code,responsible_name,status",
        )
        .eq("challenge_id", targetChallengeId)
        .order("created_at", { ascending: false }),
    ]);

    setPeriod(
      periodResult.error ? null : (periodResult.data as DeliveryPeriod | null),
    );
    setBatches(
      batchResult.error ? [] : ((batchResult.data ?? []) as DeliveryBatch[]),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadManagement(challengeId);
  }, [challengeId]);

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

  async function openPeriod(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeId || !periodStartsAt || !periodEndsAt) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("activate_medal_delivery_period", {
      target_challenge_id: challengeId,
      period_starts_at: toIso(periodStartsAt),
      period_ends_at: toIso(periodEndsAt),
      period_notes: periodNotes.trim(),
    });
    setMessage(
      error
        ? "Não foi possível abrir o período de entrega."
        : `Período aberto. ${Number(data ?? 0)} pendência(s) de medalha criada(s).`,
    );
    if (!error) {
      await Promise.all([loadManagement(challengeId), load()]);
    }
    setBusy(false);
  }

  async function closePeriod() {
    if (!challengeId) return;
    setBusy(true);
    const { error } = await supabase.rpc("close_medal_delivery_period", {
      target_challenge_id: challengeId,
    });
    setMessage(
      error
        ? "Não foi possível encerrar o período de entrega."
        : "Período de entrega encerrado.",
    );
    if (!error) await loadManagement(challengeId);
    setBusy(false);
  }

  async function createBatch(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeId || batchLabel.trim().length < 2) return;
    const stateCode = batchState.trim().toUpperCase();
    if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) {
      setMessage("Informe a UF com duas letras, por exemplo MA.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("medal_delivery_batches").insert({
      challenge_id: challengeId,
      method: batchMethod,
      label: batchLabel.trim(),
      city: batchCity.trim(),
      state_code: stateCode || null,
      responsible_name: responsibleName.trim(),
      responsible_phone: responsiblePhone.trim(),
    });
    setMessage(
      error
        ? "Não foi possível criar o lote de entrega."
        : "Lote de entrega criado.",
    );
    if (!error) {
      setBatchLabel("");
      setBatchCity("");
      setBatchState("");
      setResponsibleName("");
      setResponsiblePhone("");
      await loadManagement(challengeId);
    }
    setBusy(false);
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

      {canManage ? (
        <details>
          <summary>Gerenciar período e lotes de entrega</summary>
          <label>
            Desafio
            <select
              value={challengeId}
              onChange={(event) => setChallengeId(event.target.value)}
            >
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {challenge.public_name} · {challenge.reference_month}/
                  {challenge.reference_year}
                </option>
              ))}
            </select>
          </label>

          {period ? (
            <div className="status">
              <strong>{periodStatusLabels[period.status]}</strong> ·{" "}
              {formatDate(period.starts_at)} até {formatDate(period.ends_at)}
              {period.notes ? ` · ${period.notes}` : ""}
              {period.status === "OPEN" ? (
                <button
                  type="button"
                  className="secondary spaced"
                  disabled={busy}
                  onClick={() => void closePeriod()}
                >
                  Encerrar período
                </button>
              ) : null}
            </div>
          ) : null}

          {period?.status !== "OPEN" ? (
            <form onSubmit={openPeriod}>
              <label>
                Início do período
                <input
                  type="datetime-local"
                  value={periodStartsAt}
                  onChange={(event) => setPeriodStartsAt(event.target.value)}
                  required
                />
              </label>
              <label>
                Fim do período
                <input
                  type="datetime-local"
                  value={periodEndsAt}
                  onChange={(event) => setPeriodEndsAt(event.target.value)}
                  required
                />
              </label>
              <label>
                Observação
                <input
                  value={periodNotes}
                  onChange={(event) => setPeriodNotes(event.target.value)}
                  placeholder="Ex.: entregas de agosto"
                />
              </label>
              <button type="submit" disabled={busy || !challengeId}>
                Abrir período de entrega
              </button>
            </form>
          ) : null}

          <h3>Lotes de distribuição</h3>
          <form onSubmit={createBatch}>
            <label>
              Forma de entrega
              <select
                value={batchMethod}
                onChange={(event) =>
                  setBatchMethod(event.target.value as BatchMethod)
                }
              >
                <option value="EVENT">Evento</option>
                <option value="STORE_PICKUP">Retirada na loja</option>
                <option value="POSTAL">Correios</option>
                <option value="OTHER">Outra</option>
              </select>
            </label>
            <label>
              Identificação do lote
              <input
                value={batchLabel}
                onChange={(event) => setBatchLabel(event.target.value)}
                placeholder="Ex.: Pedal de Santa Inês - agosto"
                minLength={2}
                required
              />
            </label>
            <label>
              Cidade
              <input
                value={batchCity}
                onChange={(event) => setBatchCity(event.target.value)}
              />
            </label>
            <label>
              UF
              <input
                value={batchState}
                onChange={(event) => setBatchState(event.target.value)}
                maxLength={2}
                placeholder="MA"
              />
            </label>
            <label>
              Pessoa responsável pelo transporte/repasse
              <input
                value={responsibleName}
                onChange={(event) => setResponsibleName(event.target.value)}
              />
            </label>
            <label>
              Telefone do responsável
              <input
                value={responsiblePhone}
                onChange={(event) => setResponsiblePhone(event.target.value)}
              />
            </label>
            <button type="submit" disabled={busy || !challengeId}>
              Criar lote
            </button>
          </form>

          {batches.length ? (
            <div className="audit-list">
              {batches.map((batch) => (
                <article className="audit-item" key={batch.id}>
                  <div>
                    <strong>{batch.label}</strong>
                    <span>
                      {methodLabels[batch.method]} · {batch.status}
                    </span>
                    {batch.city ? (
                      <span>
                        {batch.city}
                        {batch.state_code ? ` - ${batch.state_code}` : ""}
                      </span>
                    ) : null}
                    {batch.responsible_name ? (
                      <span>Responsável: {batch.responsible_name}</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="status">Nenhum lote criado para este desafio.</p>
          )}
        </details>
      ) : null}

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
