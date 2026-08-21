import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { ChallengeLifecycleControls } from "./ChallengeLifecycleControls";
import { ChallengeMedalImageControl } from "./ChallengeMedalImageControl";
import { OfferLifecycleControls } from "./OfferLifecycleControls";

type Challenge = {
  id: string;
  code: string;
  public_name: string;
  medal_image_path: string | null;
  reference_year: number;
  reference_month: number | null;
  sports_starts_at: string;
  sports_ends_at: string;
  registration_type: "NORMAL" | "REPESCAGEM";
  goal_mode: "DISTANCE_KM" | "DURATION_DAYS";
  fixed_target_km: number | null;
  status:
    "DRAFT" | "SCHEDULED" | "ACTIVE" | "FINISHED" | "CANCELLED" | "ARCHIVED";
  is_public: boolean;
};

type ChallengeGoal = {
  id: string;
  challenge_id: string;
  target_km: number;
  duration_days: number | null;
  public_label: string | null;
  display_order: number;
  is_active: boolean;
};

type ChallengeOffer = {
  id: string;
  challenge_id: string;
  internal_name: string;
  public_name: string;
  category_code: string;
  registration_starts_at: string;
  registration_ends_at: string;
  price: number;
  max_per_participant: number;
  priority: number;
  status: "DRAFT" | "SCHEDULED" | "OPEN" | "CLOSED" | "DISABLED";
};

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

const statusLabel: Record<Challenge["status"], string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Programado",
  ACTIVE: "Ativo",
  FINISHED: "Encerrado",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};

const offerStatusLabel: Record<ChallengeOffer["status"], string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Programada",
  OPEN: "Aberta",
  CLOSED: "Encerrada",
  DISABLED: "Desativada",
};

function toIsoLocal(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(value),
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "desafio"
  );
}

function buildRange(start: number, step: number, end: number) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(step) ||
    !Number.isInteger(end) ||
    start <= 0 ||
    step <= 0 ||
    end < start
  ) {
    return null;
  }
  const result: number[] = [];
  for (let value = start; value <= end; value += step) {
    result.push(value);
    if (result.length > 500) return null;
  }
  return result;
}

function goalLabel(goal: ChallengeGoal, challenge: Challenge) {
  if (challenge.goal_mode === "DURATION_DAYS" && goal.duration_days) {
    return `${goal.duration_days} dias · ${goal.target_km} km`;
  }
  return goal.public_label || `${goal.target_km} km`;
}

export function ChallengesPanel({ supabase, canManage }: Props) {
  const now = useMemo(() => new Date(), []);
  const [items, setItems] = useState<Challenge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goals, setGoals] = useState<ChallengeGoal[]>([]);
  const [offers, setOffers] = useState<ChallengeOffer[]>([]);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [registrationType, setRegistrationType] = useState<
    "NORMAL" | "REPESCAGEM"
  >("NORMAL");
  const [goalMode, setGoalMode] = useState<"DISTANCE_KM" | "DURATION_DAYS">(
    "DISTANCE_KM",
  );
  const [fixedTargetKm, setFixedTargetKm] = useState("1000");
  const [referenceMonth, setReferenceMonth] = useState(now.getMonth() + 1);
  const [referenceYear, setReferenceYear] = useState(now.getFullYear());
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [rangeStart, setRangeStart] = useState("50");
  const [rangeStep, setRangeStep] = useState("25");
  const [rangeEnd, setRangeEnd] = useState("3000");
  const [manualGoal, setManualGoal] = useState("");
  const [daysStart, setDaysStart] = useState("15");
  const [daysStep, setDaysStep] = useState("15");
  const [daysEnd, setDaysEnd] = useState("90");

  const [offerInternalName, setOfferInternalName] = useState("");
  const [offerPublicName, setOfferPublicName] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerLimit, setOfferLimit] = useState("1");
  const [offerStartsAt, setOfferStartsAt] = useState("");
  const [offerEndsAt, setOfferEndsAt] = useState("");
  const [offerGoalIds, setOfferGoalIds] = useState<string[]>([]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function loadChallenges(preferredId?: string | null) {
    setBusy(true);
    setMessage("Carregando desafios…");
    const { data, error } = await supabase
      .from("challenges")
      .select(
        "id,code,public_name,medal_image_path,reference_year,reference_month,sports_starts_at,sports_ends_at,registration_type,goal_mode,fixed_target_km,status,is_public",
      )
      .order("sports_starts_at", { ascending: false });

    if (error) {
      setItems([]);
      setMessage("Não foi possível carregar os desafios.");
      setBusy(false);
      return;
    }

    const challenges = (data ?? []) as Challenge[];
    setItems(challenges);
    const nextSelected =
      preferredId && challenges.some((item) => item.id === preferredId)
        ? preferredId
        : selectedId && challenges.some((item) => item.id === selectedId)
          ? selectedId
          : (challenges[0]?.id ?? null);
    setSelectedId(nextSelected);
    setMessage(challenges.length ? "" : "Nenhum desafio cadastrado ainda.");
    setBusy(false);
  }

  async function loadChallengeDetails(challengeId: string) {
    setBusy(true);
    const [goalsResult, offersResult] = await Promise.all([
      supabase
        .from("challenge_goals")
        .select(
          "id,challenge_id,target_km,duration_days,public_label,display_order,is_active",
        )
        .eq("challenge_id", challengeId)
        .order("display_order", { ascending: true }),
      supabase
        .from("challenge_offers")
        .select(
          "id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,max_per_participant,priority,status",
        )
        .eq("challenge_id", challengeId)
        .order("priority", { ascending: true })
        .order("registration_starts_at", { ascending: true }),
    ]);

    if (goalsResult.error || offersResult.error) {
      setGoals([]);
      setOffers([]);
      setMessage("Não foi possível carregar metas e ofertas deste desafio.");
    } else {
      setGoals((goalsResult.data ?? []) as ChallengeGoal[]);
      setOffers((offersResult.data ?? []) as ChallengeOffer[]);
      setMessage("");
    }
    setBusy(false);
  }

  useEffect(() => {
    void loadChallenges();
  }, []);

  useEffect(() => {
    if (selectedId) void loadChallengeDetails(selectedId);
    else {
      setGoals([]);
      setOffers([]);
    }
    setShowGoalForm(false);
    setShowOfferForm(false);
  }, [selectedId]);

  async function nextChallengeCode() {
    const month = String(referenceMonth).padStart(2, "0");
    const base = `${slugify(name)}-${referenceYear}${month}`;
    const { data } = await supabase
      .from("challenges")
      .select("code")
      .like("code", `${base}%`);
    const used = new Set((data ?? []).map((item) => String(item.code)));
    if (!used.has(base)) return base;
    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  async function createChallenge(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setMessage("Confira o início e o fim do período esportivo.");
      return;
    }
    const fixedKm = goalMode === "DURATION_DAYS" ? Number(fixedTargetKm) : null;
    if (
      goalMode === "DURATION_DAYS" &&
      (!Number.isInteger(fixedKm) || Number(fixedKm) <= 0)
    ) {
      setMessage("Informe a distância fixa do desafio em quilômetros.");
      return;
    }

    setBusy(true);
    setMessage("Salvando desafio…");
    const generatedCode = await nextChallengeCode();
    const { data, error } = await supabase
      .from("challenges")
      .insert({
        code: generatedCode,
        public_name: name.trim(),
        reference_year: referenceYear,
        reference_month: referenceMonth,
        sports_starts_at: toIsoLocal(startsAt),
        sports_ends_at: toIsoLocal(endsAt),
        timezone: "America/Fortaleza",
        registration_type: registrationType,
        goal_mode: goalMode,
        fixed_target_km: fixedKm,
        status: "DRAFT",
        is_public: false,
      })
      .select("id")
      .single();

    if (error) {
      setMessage("Não foi possível salvar o desafio.");
      setBusy(false);
      return;
    }

    await supabase.rpc("write_audit_event", {
      event_action: "challenge.created",
      event_application_version: "challenges-goal-modes-v1",
      event_metadata: {
        code: generatedCode,
        registration_type: registrationType,
        goal_mode: goalMode,
      },
      event_outcome: "success",
      event_reason: null,
      event_request_id: crypto.randomUUID(),
      event_resource_type: "challenge",
    });

    setName("");
    setRegistrationType("NORMAL");
    setGoalMode("DISTANCE_KM");
    setFixedTargetKm("1000");
    setStartsAt("");
    setEndsAt("");
    setShowForm(false);
    await loadChallenges(data.id);
    setMessage(`Desafio criado em rascunho. Código: ${generatedCode}`);
  }

  async function insertGoals(rows: Array<Record<string, unknown>>) {
    if (!selected || !rows.length) return;
    setBusy(true);
    const { error } = await supabase.from("challenge_goals").insert(rows);
    if (error) {
      setMessage(
        error.code === "23505"
          ? "Uma ou mais metas já estão cadastradas neste desafio."
          : "Não foi possível cadastrar as metas.",
      );
      setBusy(false);
      return;
    }
    setShowGoalForm(false);
    await loadChallengeDetails(selected.id);
    setMessage(
      rows.length === 1 ? "Meta adicionada." : `${rows.length} metas geradas.`,
    );
  }

  async function generateDistanceGoals(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || !selected) return;
    const values = buildRange(
      Number(rangeStart),
      Number(rangeStep),
      Number(rangeEnd),
    );
    if (!values) {
      setMessage("Confira a menor meta, a variação e a maior meta.");
      return;
    }
    await insertGoals(
      values.map((targetKm, index) => ({
        challenge_id: selected.id,
        target_km: targetKm,
        duration_days: null,
        public_label: `${targetKm} km`,
        display_order: goals.length + index,
        is_active: true,
      })),
    );
  }

  async function createManualGoal(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || !selected) return;
    const targetKm = Number(manualGoal);
    if (!Number.isInteger(targetKm) || targetKm <= 0) {
      setMessage("Informe somente números inteiros maiores que zero.");
      return;
    }
    await insertGoals([
      {
        challenge_id: selected.id,
        target_km: targetKm,
        duration_days: null,
        public_label: `${targetKm} km`,
        display_order: goals.length,
        is_active: true,
      },
    ]);
    setManualGoal("");
  }

  async function generateDurationGoals(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || !selected || !selected.fixed_target_km) return;
    const values = buildRange(
      Number(daysStart),
      Number(daysStep),
      Number(daysEnd),
    );
    if (!values) {
      setMessage("Confira o menor prazo, a variação e o maior prazo.");
      return;
    }
    await insertGoals(
      values.map((days, index) => ({
        challenge_id: selected.id,
        target_km: selected.fixed_target_km,
        duration_days: days,
        public_label: `${days} dias`,
        display_order: goals.length + index,
        is_active: true,
      })),
    );
  }

  async function createOffer(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || !selected) return;
    if (
      !offerStartsAt ||
      !offerEndsAt ||
      new Date(offerEndsAt) <= new Date(offerStartsAt)
    ) {
      setMessage("Confira o início e o fim da oferta.");
      return;
    }
    const price = Number(offerPrice.replace(",", "."));
    const limit = Number(offerLimit);
    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(limit) ||
      limit < 1
    ) {
      setMessage("Confira o valor e o limite por participante.");
      return;
    }
    if (!offerGoalIds.length) {
      setMessage("Selecione pelo menos uma meta disponível nesta oferta.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("challenge_offers")
      .insert({
        challenge_id: selected.id,
        internal_name: offerInternalName.trim(),
        public_name: offerPublicName.trim(),
        category_code: selected.registration_type,
        registration_starts_at: toIsoLocal(offerStartsAt),
        registration_ends_at: toIsoLocal(offerEndsAt),
        price,
        max_per_participant: limit,
        priority: offers.length,
        status: "DRAFT",
      })
      .select("id")
      .single();

    if (error) {
      setMessage("Não foi possível cadastrar a oferta.");
      setBusy(false);
      return;
    }

    const links = offerGoalIds.map((goalId) => ({
      offer_id: data.id,
      goal_id: goalId,
    }));
    const { error: linkError } = await supabase
      .from("challenge_offer_goals")
      .insert(links);
    if (linkError) {
      await supabase.from("challenge_offers").delete().eq("id", data.id);
      setMessage(
        "A oferta não foi salva porque as metas não puderam ser vinculadas.",
      );
      setBusy(false);
      return;
    }

    setOfferInternalName("");
    setOfferPublicName("");
    setOfferPrice("");
    setOfferLimit("1");
    setOfferStartsAt("");
    setOfferEndsAt("");
    setOfferGoalIds([]);
    setShowOfferForm(false);
    await loadChallengeDetails(selected.id);
    setMessage("Oferta adicionada em rascunho.");
  }

  function toggleOfferGoal(goalId: string) {
    setOfferGoalIds((current) =>
      current.includes(goalId)
        ? current.filter((id) => id !== goalId)
        : [...current, goalId],
    );
  }

  return (
    <section className="module-panel" aria-labelledby="challenges-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operação</p>
          <h2 id="challenges-title">Desafios</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            className="compact"
            onClick={() => setShowForm((value) => !value)}
            disabled={busy}
          >
            {showForm ? "Cancelar" : "Novo desafio"}
          </button>
        ) : null}
      </div>
      <p className="section-description">
        Cadastre o desafio, a foto da medalha, as metas e a oferta de inscrição.
      </p>

      {showForm ? (
        <form className="challenge-form" onSubmit={createChallenge}>
          <label>
            Nome público
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Desafio Giro 1000 km"
              required
              minLength={2}
            />
          </label>
          <p className="mini-description">
            O código interno será criado automaticamente pelo sistema.
          </p>
          <div className="form-grid two">
            <label>
              Tipo do desafio
              <select
                value={registrationType}
                onChange={(event) =>
                  setRegistrationType(
                    event.target.value as "NORMAL" | "REPESCAGEM",
                  )
                }
              >
                <option value="NORMAL">Normal</option>
                <option value="REPESCAGEM">Repescagem</option>
              </select>
            </label>
            <label>
              Forma da meta
              <select
                value={goalMode}
                onChange={(event) =>
                  setGoalMode(
                    event.target.value as "DISTANCE_KM" | "DURATION_DAYS",
                  )
                }
              >
                <option value="DISTANCE_KM">Distância em km</option>
                <option value="DURATION_DAYS">Prazo em dias</option>
              </select>
            </label>
          </div>
          {goalMode === "DURATION_DAYS" ? (
            <label>
              Distância fixa para todos (km)
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={fixedTargetKm}
                onChange={(event) => setFixedTargetKm(event.target.value)}
                required
              />
            </label>
          ) : null}
          <div className="form-grid two">
            <label>
              Mês de referência
              <input
                type="number"
                min={1}
                max={12}
                value={referenceMonth}
                onChange={(event) =>
                  setReferenceMonth(Number(event.target.value))
                }
                required
              />
            </label>
            <label>
              Ano de referência
              <input
                type="number"
                min={2020}
                max={2200}
                value={referenceYear}
                onChange={(event) =>
                  setReferenceYear(Number(event.target.value))
                }
                required
              />
            </label>
          </div>
          <div className="form-grid two">
            <label>
              Início do período esportivo
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>
            <label>
              Fim do período esportivo
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            </label>
          </div>
          {goalMode === "DURATION_DAYS" ? (
            <p className="mini-description">
              O início e o término previstos de cada participante serão
              calculados conforme o prazo escolhido quando a inscrição for
              confirmada.
            </p>
          ) : null}
          <div className="form-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Criar rascunho"}
            </button>
          </div>
        </form>
      ) : null}

      <p role="status" className="status">
        {message}
      </p>

      <div className="challenge-list">
        {items.map((item) => (
          <button
            type="button"
            className={`challenge-item challenge-select ${item.id === selectedId ? "selected" : ""}`}
            key={item.id}
            onClick={() => setSelectedId(item.id)}
          >
            <div className="challenge-main">
              <div className="challenge-title-row">
                <strong>{item.public_name}</strong>
                <span
                  className={`challenge-status ${item.status.toLowerCase()}`}
                >
                  {statusLabel[item.status]}
                </span>
              </div>
              <span className="challenge-code">{item.code}</span>
              <span>
                {item.registration_type === "NORMAL" ? "Normal" : "Repescagem"}{" "}
                ·{" "}
                {item.goal_mode === "DISTANCE_KM"
                  ? "meta em km"
                  : `${item.fixed_target_km ?? 0} km por prazo`}
              </span>
              <span>
                {formatDate(item.sports_starts_at)} a{" "}
                {formatDate(item.sports_ends_at)}
              </span>
            </div>
            <div className="challenge-side">
              <span>
                {item.reference_month
                  ? `${String(item.reference_month).padStart(2, "0")}/${item.reference_year}`
                  : item.reference_year}
              </span>
              <span>{item.is_public ? "Visível" : "Não publicado"}</span>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="challenge-detail">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Configuração</p>
              <h2>{selected.public_name}</h2>
            </div>
          </div>

          <ChallengeLifecycleControls
            supabase={supabase}
            challengeId={selected.id}
            status={selected.status}
            canManage={canManage}
            onChanged={async () => {
              await loadChallenges(selected.id);
              await loadChallengeDetails(selected.id);
            }}
          />

          <ChallengeMedalImageControl
            supabase={supabase}
            challengeId={selected.id}
            challengeName={selected.public_name}
            medalImagePath={selected.medal_image_path}
            canManage={canManage}
            onChanged={async () => loadChallenges(selected.id)}
          />

          <div className="challenge-config-grid">
            <section className="config-card">
              <div className="section-heading">
                <div>
                  <h3>
                    {selected.goal_mode === "DURATION_DAYS"
                      ? "Prazos"
                      : "Metas"}
                  </h3>
                  <p className="mini-description">
                    {selected.goal_mode === "DURATION_DAYS"
                      ? `Todos cumprem ${selected.fixed_target_km} km; o participante escolhe o prazo.`
                      : selected.registration_type === "NORMAL"
                        ? "Gere as quilometragens em lote."
                        : "Cadastre somente as quilometragens disponíveis para a repescagem."}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="compact"
                    onClick={() => setShowGoalForm((value) => !value)}
                    disabled={busy}
                  >
                    {showGoalForm ? "Cancelar" : "Configurar metas"}
                  </button>
                ) : null}
              </div>

              {showGoalForm &&
              selected.goal_mode === "DISTANCE_KM" &&
              selected.registration_type === "NORMAL" ? (
                <form className="compact-form" onSubmit={generateDistanceGoals}>
                  <div className="form-grid three">
                    <label>
                      Menor km
                      <input
                        type="number"
                        min={1}
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Variação
                      <input
                        type="number"
                        min={1}
                        value={rangeStep}
                        onChange={(e) => setRangeStep(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Maior km
                      <input
                        type="number"
                        min={1}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit" disabled={busy}>
                      Gerar metas
                    </button>
                  </div>
                </form>
              ) : null}

              {showGoalForm &&
              selected.goal_mode === "DISTANCE_KM" &&
              selected.registration_type === "REPESCAGEM" ? (
                <form className="compact-form" onSubmit={createManualGoal}>
                  <label>
                    Quilômetros disponíveis
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={manualGoal}
                      onChange={(event) => setManualGoal(event.target.value)}
                      placeholder="Ex.: 300"
                      required
                    />
                  </label>
                  <div className="form-actions">
                    <button type="submit" disabled={busy}>
                      Adicionar meta
                    </button>
                  </div>
                </form>
              ) : null}

              {showGoalForm && selected.goal_mode === "DURATION_DAYS" ? (
                <form className="compact-form" onSubmit={generateDurationGoals}>
                  <div className="form-grid three">
                    <label>
                      Menor prazo (dias)
                      <input
                        type="number"
                        min={1}
                        value={daysStart}
                        onChange={(e) => setDaysStart(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Variação (dias)
                      <input
                        type="number"
                        min={1}
                        value={daysStep}
                        onChange={(e) => setDaysStep(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Maior prazo (dias)
                      <input
                        type="number"
                        min={1}
                        value={daysEnd}
                        onChange={(e) => setDaysEnd(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit" disabled={busy}>
                      Gerar prazos
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="simple-list">
                {goals.map((goal) => (
                  <div className="simple-row" key={goal.id}>
                    <strong>{goalLabel(goal, selected)}</strong>
                    <span>{goal.is_active ? "Ativa" : "Inativa"}</span>
                  </div>
                ))}
                {!goals.length ? (
                  <p className="empty-note">Nenhuma meta cadastrada.</p>
                ) : null}
              </div>
            </section>

            <section className="config-card">
              <div className="section-heading">
                <div>
                  <h3>Ofertas de inscrição</h3>
                  <p className="mini-description">
                    Tipo{" "}
                    {selected.registration_type === "NORMAL"
                      ? "Normal"
                      : "Repescagem"}
                    ; configure preço, período, limite e metas.
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="compact"
                    onClick={() => setShowOfferForm((value) => !value)}
                    disabled={busy || !goals.length}
                  >
                    {showOfferForm ? "Cancelar" : "Adicionar oferta"}
                  </button>
                ) : null}
              </div>

              {showOfferForm ? (
                <form className="compact-form" onSubmit={createOffer}>
                  <div className="form-grid two">
                    <label>
                      Nome interno
                      <input
                        value={offerInternalName}
                        onChange={(e) => setOfferInternalName(e.target.value)}
                        placeholder="Agosto 2026"
                        required
                        minLength={2}
                      />
                    </label>
                    <label>
                      Nome para o público
                      <input
                        value={offerPublicName}
                        onChange={(e) => setOfferPublicName(e.target.value)}
                        placeholder="Inscrição Agosto"
                        required
                        minLength={2}
                      />
                    </label>
                  </div>
                  <label>
                    Valor (R$)
                    <input
                      inputMode="decimal"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      placeholder="44,90"
                      required
                    />
                  </label>
                  <div className="form-grid two">
                    <label>
                      Início das inscrições
                      <input
                        type="datetime-local"
                        value={offerStartsAt}
                        onChange={(e) => setOfferStartsAt(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Fim das inscrições
                      <input
                        type="datetime-local"
                        value={offerEndsAt}
                        onChange={(e) => setOfferEndsAt(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Limite por participante
                    <input
                      type="number"
                      min={1}
                      value={offerLimit}
                      onChange={(e) => setOfferLimit(e.target.value)}
                      required
                    />
                  </label>
                  <fieldset className="goal-picker">
                    <legend>
                      {selected.goal_mode === "DURATION_DAYS"
                        ? "Prazos disponíveis"
                        : "Metas disponíveis"}
                    </legend>
                    {goals
                      .filter((goal) => goal.is_active)
                      .map((goal) => (
                        <label className="check-row" key={goal.id}>
                          <input
                            type="checkbox"
                            checked={offerGoalIds.includes(goal.id)}
                            onChange={() => toggleOfferGoal(goal.id)}
                          />
                          <span>{goalLabel(goal, selected)}</span>
                        </label>
                      ))}
                  </fieldset>
                  <div className="form-actions">
                    <button type="submit" disabled={busy}>
                      Salvar oferta em rascunho
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="simple-list">
                {offers.map((offer) => (
                  <div className="offer-row" key={offer.id}>
                    <div>
                      <strong>{offer.public_name}</strong>
                      <span>
                        {offer.internal_name} · {offer.category_code}
                      </span>
                    </div>
                    <div className="offer-side">
                      <strong>{formatMoney(Number(offer.price))}</strong>
                      <span>
                        {formatDate(offer.registration_starts_at)} a{" "}
                        {formatDate(offer.registration_ends_at)}
                      </span>
                      <span>
                        {offerStatusLabel[offer.status]} · limite{" "}
                        {offer.max_per_participant}
                      </span>
                      <OfferLifecycleControls
                        supabase={supabase}
                        offerId={offer.id}
                        offerStatus={offer.status}
                        challengeStatus={selected.status}
                        canManage={canManage}
                        onChanged={() => loadChallengeDetails(selected.id)}
                      />
                    </div>
                  </div>
                ))}
                {!offers.length ? (
                  <p className="empty-note">Nenhuma oferta cadastrada.</p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {items.length ? (
        <button
          type="button"
          className="link-button"
          onClick={() => void loadChallenges(selectedId)}
          disabled={busy}
        >
          Atualizar lista
        </button>
      ) : null}
    </section>
  );
}
