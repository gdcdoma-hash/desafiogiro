import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { ChallengeMedalImageControl } from "./ChallengeMedalImageControl";

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
  participant_start_opens_on: string | null;
  participant_start_closes_on: string | null;
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
  DRAFT: "Em configuração",
  SCHEDULED: "Pronto para iniciar",
  ACTIVE: "Ativo",
  FINISHED: "Encerrado",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};

const LOCAL_DRAFT_KEY = "portal-giro:admin:challenge-unsaved-v1";
const ACTIVE_CHALLENGE_KEY = "portal-giro:admin:challenge-active-v1";

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
  const [startWindowOpen, setStartWindowOpen] = useState("");
  const [startWindowClose, setStartWindowClose] = useState("");

  const [rangeStart, setRangeStart] = useState("50");
  const [rangeStep, setRangeStep] = useState("25");
  const [rangeEnd, setRangeEnd] = useState("3000");
  const [manualGoal, setManualGoal] = useState("");
  const [daysStart, setDaysStart] = useState("15");
  const [daysStep, setDaysStep] = useState("15");
  const [daysEnd, setDaysEnd] = useState("90");

  const [offerPrice, setOfferPrice] = useState("");
  const [offerLimit, setOfferLimit] = useState("1");
  const [offerStartsAt, setOfferStartsAt] = useState("");
  const [offerEndsAt, setOfferEndsAt] = useState("");
  const [offerGoalIds, setOfferGoalIds] = useState<string[]>([]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const saved = window.localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved) as Record<string, unknown>;
      setName(String(draft.name ?? ""));
      setRegistrationType(
        draft.registrationType === "REPESCAGEM" ? "REPESCAGEM" : "NORMAL",
      );
      setGoalMode(
        draft.goalMode === "DURATION_DAYS" ? "DURATION_DAYS" : "DISTANCE_KM",
      );
      setFixedTargetKm(String(draft.fixedTargetKm ?? "1000"));
      setReferenceMonth(Number(draft.referenceMonth) || now.getMonth() + 1);
      setReferenceYear(Number(draft.referenceYear) || now.getFullYear());
      setStartsAt(String(draft.startsAt ?? ""));
      setEndsAt(String(draft.endsAt ?? ""));
      setStartWindowOpen(String(draft.startWindowOpen ?? ""));
      setStartWindowClose(String(draft.startWindowClose ?? ""));
      setShowForm(true);
    } catch {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    }
  }, [now]);

  useEffect(() => {
    if (!showForm || selectedId) return;
    window.localStorage.setItem(
      LOCAL_DRAFT_KEY,
      JSON.stringify({
        name,
        registrationType,
        goalMode,
        fixedTargetKm,
        referenceMonth,
        referenceYear,
        startsAt,
        endsAt,
        startWindowOpen,
        startWindowClose,
      }),
    );
  }, [
    showForm,
    selectedId,
    name,
    registrationType,
    goalMode,
    fixedTargetKm,
    referenceMonth,
    referenceYear,
    startsAt,
    endsAt,
    startWindowOpen,
    startWindowClose,
  ]);

  async function loadChallenges(preferredId?: string | null) {
    setBusy(true);
    setMessage("Carregando desafios…");
    const { data, error } = await supabase
      .from("challenges")
      .select(
        "id,code,public_name,medal_image_path,reference_year,reference_month,sports_starts_at,sports_ends_at,registration_type,goal_mode,fixed_target_km,participant_start_opens_on,participant_start_closes_on,status,is_public",
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
    const rememberedId = window.localStorage.getItem(ACTIVE_CHALLENGE_KEY);
    const hasUnsavedDraft = window.localStorage.getItem(LOCAL_DRAFT_KEY);
    const nextSelected =
      preferredId && challenges.some((item) => item.id === preferredId)
        ? preferredId
        : hasUnsavedDraft
          ? null
          : rememberedId && challenges.some((item) => item.id === rememberedId)
            ? rememberedId
            : selectedId && challenges.some((item) => item.id === selectedId)
              ? selectedId
              : null;
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
      setMessage("Não foi possível carregar metas e condições deste desafio.");
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

  useEffect(() => {
    if (selectedId) {
      window.localStorage.setItem(ACTIVE_CHALLENGE_KEY, selectedId);
    }
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
    if (
      goalMode === "DISTANCE_KM" &&
      (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt))
    ) {
      setMessage("Confira o início e o fim do período esportivo.");
      return;
    }
    if (
      goalMode === "DURATION_DAYS" &&
      (!startWindowOpen ||
        !startWindowClose ||
        startWindowClose < startWindowOpen)
    ) {
      setMessage("Confira o primeiro e o último dia permitidos para iniciar.");
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
        sports_starts_at:
          goalMode === "DISTANCE_KM"
            ? toIsoLocal(`${startsAt}T00:00`)
            : toIsoLocal(`${startWindowOpen}T00:00`),
        sports_ends_at:
          goalMode === "DISTANCE_KM"
            ? toIsoLocal(`${endsAt}T23:59`)
            : toIsoLocal(`${startWindowClose}T23:59`),
        timezone: "America/Fortaleza",
        registration_type: registrationType,
        goal_mode: goalMode,
        fixed_target_km: fixedKm,
        participant_start_opens_on:
          goalMode === "DURATION_DAYS" ? startWindowOpen : null,
        participant_start_closes_on:
          goalMode === "DURATION_DAYS" ? startWindowClose : null,
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

    if (goalMode === "DISTANCE_KM" && registrationType === "NORMAL") {
      const defaultGoals = buildRange(50, 25, 3000) ?? [];
      const { error: goalsError } = await supabase
        .from("challenge_goals")
        .insert(
          defaultGoals.map((targetKm, displayOrder) => ({
            challenge_id: data.id,
            target_km: targetKm,
            duration_days: null,
            public_label: `${targetKm} km`,
            display_order: displayOrder,
            is_active: true,
          })),
        );
      if (goalsError) {
        setMessage(
          "O desafio foi salvo, mas as metas padrão não puderam ser criadas.",
        );
      }
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

    window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    setName("");
    setRegistrationType("NORMAL");
    setGoalMode("DISTANCE_KM");
    setFixedTargetKm("1000");
    setReferenceMonth(now.getMonth() + 1);
    setReferenceYear(now.getFullYear());
    setStartsAt("");
    setEndsAt("");
    setStartWindowOpen("");
    setStartWindowClose("");
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
      setMessage("Confira o início e o fim da condição de inscrição.");
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
      setMessage("Selecione pelo menos uma meta disponível nesta condição.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("challenge_offers")
      .insert({
        challenge_id: selected.id,
        internal_name: `${selected.code}-${offers.length + 1}`.slice(0, 120),
        public_name: `${selected.public_name} · ${offers.length + 1}`.slice(
          0,
          120,
        ),
        category_code: selected.registration_type,
        registration_starts_at: toIsoLocal(`${offerStartsAt}T00:00`),
        registration_ends_at: toIsoLocal(`${offerEndsAt}T23:59`),
        price,
        max_per_participant: limit,
        priority: offers.length,
        status: "DRAFT",
      })
      .select("id")
      .single();

    if (error) {
      setMessage("Não foi possível cadastrar a condição de inscrição.");
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
        "A condição não foi salva porque as metas não puderam ser vinculadas.",
      );
      setBusy(false);
      return;
    }

    setOfferPrice("");
    setOfferLimit("1");
    setOfferStartsAt("");
    setOfferEndsAt("");
    setOfferGoalIds([]);
    setShowOfferForm(false);
    await loadChallengeDetails(selected.id);
    setMessage("Condição adicionada em configuração.");
  }

  function toggleOfferGoal(goalId: string) {
    setOfferGoalIds((current) =>
      current.includes(goalId)
        ? current.filter((id) => id !== goalId)
        : [...current, goalId],
    );
  }

  async function refreshSelected() {
    if (!selected) return;
    await loadChallenges(selected.id);
    await loadChallengeDetails(selected.id);
  }

  async function publishChallenge() {
    if (!canManage || !selected || busy) return;
    if (!goals.length || !offers.length) {
      setMessage("Cadastre pelo menos uma meta e um preço antes de publicar.");
      return;
    }
    setBusy(true);
    setMessage("Publicando desafio…");
    const shouldStart = new Date(selected.sports_starts_at) <= new Date();
    const nextOfferStatus = shouldStart ? "OPEN" : "SCHEDULED";
    const offerIds = offers
      .filter((offer) => offer.status === "DRAFT")
      .map((offer) => offer.id);
    let challengeResult = await supabase
      .from("challenges")
      .update({ status: "SCHEDULED", is_public: true })
      .eq("id", selected.id);
    if (!challengeResult.error && shouldStart) {
      challengeResult = await supabase
        .from("challenges")
        .update({ status: "ACTIVE" })
        .eq("id", selected.id);
    }
    const offerResult =
      !challengeResult.error && offerIds.length
        ? await supabase
            .from("challenge_offers")
            .update({ status: nextOfferStatus })
            .in("id", offerIds)
        : { error: challengeResult.error };
    setMessage(
      challengeResult.error || offerResult.error
        ? "Não foi possível publicar. Confira datas, metas e preço."
        : "Desafio publicado com sucesso.",
    );
    await refreshSelected();
    setBusy(false);
  }

  async function setRegistrationPaused(paused: boolean) {
    if (!canManage || !selected || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("challenges")
      .update({ is_public: !paused })
      .eq("id", selected.id);
    setMessage(
      error
        ? "Não foi possível alterar as inscrições."
        : paused
          ? "Inscrições pausadas."
          : "Inscrições retomadas.",
    );
    await refreshSelected();
    setBusy(false);
  }

  async function finishChallenge() {
    if (
      !selected ||
      !window.confirm(
        "Encerrar este desafio agora? Esta ação antecipa o encerramento e não pode ser desfeita.",
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase
      .from("challenges")
      .update({ status: "FINISHED", is_public: false })
      .eq("id", selected.id);
    setMessage(
      error ? "Não foi possível encerrar o desafio." : "Desafio encerrado.",
    );
    await refreshSelected();
    setBusy(false);
  }

  async function cancelChallenge() {
    if (
      !selected ||
      !window.confirm(
        "Cancelar este desafio? Cancelamento é diferente do encerramento normal e não pode ser desfeito.",
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase
      .from("challenges")
      .update({ status: "CANCELLED", is_public: false })
      .eq("id", selected.id);
    setMessage(
      error ? "Não foi possível cancelar o desafio." : "Desafio cancelado.",
    );
    await refreshSelected();
    setBusy(false);
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
            onClick={() => {
              setSelectedId(null);
              window.localStorage.removeItem(ACTIVE_CHALLENGE_KEY);
              setShowForm((value) => !value);
            }}
            disabled={busy}
          >
            {showForm ? "Cancelar" : "Novo desafio"}
          </button>
        ) : null}
      </div>
      <p className="section-description">
        Configure todos os dados do desafio em uma única sequência.
      </p>

      {showForm ? (
        <form className="challenge-form" onSubmit={createChallenge}>
          <section className="config-card form-section">
            <h3>Identificação</h3>
            <label>
              Nome do desafio
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
                  onChange={(event) => {
                    const nextMode = event.target.value as
                      "DISTANCE_KM" | "DURATION_DAYS";
                    setGoalMode(nextMode);
                    if (nextMode === "DURATION_DAYS" && !startWindowOpen) {
                      const first = `${referenceYear}-${String(referenceMonth).padStart(2, "0")}-01`;
                      const lastDay = new Date(
                        referenceYear,
                        referenceMonth,
                        0,
                      ).getDate();
                      setStartWindowOpen(first);
                      setStartWindowClose(
                        `${referenceYear}-${String(referenceMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
                      );
                    }
                  }}
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
          </section>
          <section className="config-card form-section">
            <h3>Período do desafio</h3>
            {goalMode === "DISTANCE_KM" ? (
              <div className="form-grid two">
                <label>
                  Início do desafio
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Fim do desafio
                  <input
                    type="date"
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                    required
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="form-grid two">
                  <label>
                    Primeiro dia permitido para iniciar
                    <input
                      type="date"
                      value={startWindowOpen}
                      onChange={(event) =>
                        setStartWindowOpen(event.target.value)
                      }
                      required
                    />
                  </label>
                  <label>
                    Último dia permitido para iniciar
                    <input
                      type="date"
                      min={startWindowOpen || undefined}
                      value={startWindowClose}
                      onChange={(event) =>
                        setStartWindowClose(event.target.value)
                      }
                      required
                    />
                  </label>
                </div>
                <p className="mini-description">
                  Cada participante terá seu próprio período. Quem se inscrever
                  antes pode escolher uma data futura dentro desta janela; quem
                  entrar durante o mês começa, no mínimo, na data da inscrição.
                  O término será calculado pelo prazo escolhido.
                </p>
              </>
            )}
          </section>
          <section className="config-card form-section">
            <h3>Metas</h3>
            <p className="summary-line">
              {goalMode === "DURATION_DAYS"
                ? `${fixedTargetKm || "—"} km · prazos configuráveis após salvar`
                : registrationType === "NORMAL"
                  ? "50 a 3000 km · variação 25 km"
                  : "Metas escolhidas manualmente após salvar"}
            </p>
          </section>
          <section className="config-card form-section">
            <h3>Inscrições e preço</h3>
            <p className="mini-description">
              Datas, preço e lotes serão configurados de forma simples após
              salvar o rascunho.
            </p>
          </section>
          <section className="config-card form-section">
            <h3>Limites por participante</h3>
            <p className="summary-line">
              Normal: 1 <span aria-hidden="true">·</span> Repescagem: 3
            </p>
          </section>
          <section className="config-card form-section">
            <h3>Imagem do desafio</h3>
            <p className="mini-description">
              A imagem da medalha poderá ser enviada após salvar o rascunho.
            </p>
          </section>
          <section className="config-card form-section">
            <h3>Revisão e publicação</h3>
            <p className="mini-description">
              Revise a identificação e o período. O rascunho continuará
              disponível para completar depois.
            </p>
            <div className="form-actions">
              <button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar rascunho"}
              </button>
            </div>
          </section>
        </form>
      ) : null}

      <p role="status" className="status">
        {message}
      </p>

      {!showForm && !selected ? (
        <section className="challenge-catalog">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Consulta</p>
              <h3>Desafios cadastrados</h3>
            </div>
          </div>
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
                    {item.registration_type === "NORMAL"
                      ? "Normal"
                      : "Repescagem"}{" "}
                    ·{" "}
                    {item.goal_mode === "DISTANCE_KM"
                      ? "meta em km"
                      : `${item.fixed_target_km ?? 0} km por prazo`}
                  </span>
                  <span>
                    {item.goal_mode === "DURATION_DAYS" &&
                    item.participant_start_opens_on &&
                    item.participant_start_closes_on
                      ? `Inícios permitidos: ${formatDate(item.participant_start_opens_on + "T12:00:00")} a ${formatDate(item.participant_start_closes_on + "T12:00:00")}`
                      : `${formatDate(item.sports_starts_at)} a ${formatDate(item.sports_ends_at)}`}
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
        </section>
      ) : null}

      {selected ? (
        <div className="challenge-detail">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Configuração</p>
              <h2>{selected.public_name}</h2>
            </div>
            <button
              type="button"
              className="compact secondary"
              onClick={() => {
                window.localStorage.removeItem(ACTIVE_CHALLENGE_KEY);
                setSelectedId(null);
                setShowForm(false);
              }}
            >
              Ver desafios cadastrados
            </button>
          </div>

          <section className="config-card">
            <h3>Identificação</h3>
            <div className="simple-list">
              <div className="simple-row">
                <strong>Nome do desafio</strong>
                <span>{selected.public_name}</span>
              </div>
              <div className="simple-row">
                <strong>Tipo e meta</strong>
                <span>
                  {selected.registration_type === "NORMAL"
                    ? "Normal"
                    : "Repescagem"}{" "}
                  ·{" "}
                  {selected.goal_mode === "DISTANCE_KM"
                    ? "Distância em km"
                    : `${selected.fixed_target_km} km por prazo`}
                </span>
              </div>
            </div>
          </section>

          <h3 className="flow-step-title">Imagem do desafio</h3>
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
                    {""}
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
                    {showGoalForm ? "Fechar edição" : "Editar metas"}
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

              <div className="goal-chip-list" aria-label="Metas disponíveis">
                {goals.map((goal) => (
                  <span className="goal-chip" key={goal.id}>
                    {goalLabel(goal, selected)}
                  </span>
                ))}
                {!goals.length ? (
                  <p className="empty-note">Nenhuma meta cadastrada.</p>
                ) : null}
              </div>
            </section>

            <section className="config-card">
              <div className="section-heading">
                <div>
                  <h3>Inscrições e preço</h3>
                  <p className="mini-description">
                    Tipo{" "}
                    {selected.registration_type === "NORMAL"
                      ? "Normal"
                      : "Repescagem"}
                    ; configure datas e valor para o participante.
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="compact"
                    onClick={() => {
                      setOfferLimit(
                        offers[0]?.max_per_participant.toString() ??
                          (selected.registration_type === "REPESCAGEM"
                            ? "3"
                            : "1"),
                      );
                      setShowOfferForm((value) => !value);
                    }}
                    disabled={busy || !goals.length}
                  >
                    {showOfferForm ? "Fechar edição" : "Editar preço"}
                  </button>
                ) : null}
              </div>

              {showOfferForm ? (
                <form className="compact-form" onSubmit={createOffer}>
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
                        type="date"
                        value={offerStartsAt}
                        onChange={(e) => setOfferStartsAt(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Fim das inscrições
                      <input
                        type="date"
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
                      Salvar preço
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="simple-list">
                {offers.map((offer) => (
                  <div className="offer-row" key={offer.id}>
                    <div>
                      <strong>{formatMoney(Number(offer.price))}</strong>
                      <span>
                        Inscrições de {formatDate(offer.registration_starts_at)}{" "}
                        até {formatDate(offer.registration_ends_at)}
                      </span>
                    </div>
                    <div className="offer-side">
                      <span>
                        Limite por participante: {offer.max_per_participant}
                      </span>
                    </div>
                  </div>
                ))}
                {!offers.length ? (
                  <p className="empty-note">Nenhuma condição cadastrada.</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="config-card review-card">
            <h3>Revisão e publicação</h3>
            <p className="summary-line">
              {goals.length} metas · {offers.length}{" "}
              {offers.length === 1 ? "preço" : "preços"} ·{" "}
              {statusLabel[selected.status]}
            </p>
            {canManage ? (
              <div className="lifecycle-actions">
                {selected.status === "DRAFT" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void publishChallenge()}
                  >
                    Publicar desafio
                  </button>
                ) : null}
                {selected.status === "SCHEDULED" ||
                selected.status === "ACTIVE" ? (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void setRegistrationPaused(selected.is_public)
                      }
                    >
                      {selected.is_public
                        ? "Pausar inscrições"
                        : "Retomar inscrições"}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() => void finishChallenge()}
                    >
                      Encerrar desafio agora
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            {canManage &&
            !["FINISHED", "CANCELLED", "ARCHIVED"].includes(selected.status) ? (
              <div className="danger-zone">
                <p>Área secundária</p>
                <button
                  type="button"
                  className="link-button danger-link"
                  disabled={busy}
                  onClick={() => void cancelChallenge()}
                >
                  Cancelar desafio
                </button>
              </div>
            ) : null}
          </section>
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
