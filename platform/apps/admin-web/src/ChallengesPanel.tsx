import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Challenge = {
  id: string;
  code: string;
  public_name: string;
  reference_year: number;
  reference_month: number | null;
  sports_starts_at: string;
  sports_ends_at: string;
  status:
    "DRAFT" | "SCHEDULED" | "ACTIVE" | "FINISHED" | "CANCELLED" | "ARCHIVED";
  is_public: boolean;
};

type ChallengeGoal = {
  id: string;
  challenge_id: string;
  target_km: number;
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
  const [code, setCode] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(now.getMonth() + 1);
  const [referenceYear, setReferenceYear] = useState(now.getFullYear());
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [goalKm, setGoalKm] = useState("");
  const [goalLabel, setGoalLabel] = useState("");
  const [offerInternalName, setOfferInternalName] = useState("");
  const [offerPublicName, setOfferPublicName] = useState("");
  const [offerCategory, setOfferCategory] = useState("NORMAL");
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
        "id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status,is_public",
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
          "id,challenge_id,target_km,public_label,display_order,is_active",
        )
        .eq("challenge_id", challengeId)
        .order("display_order", { ascending: true })
        .order("target_km", { ascending: true }),
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
  }, [selectedId]);

  async function createChallenge(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setMessage("Confira o início e o fim do período esportivo.");
      return;
    }

    setBusy(true);
    setMessage("Salvando desafio…");
    const normalizedCode = code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const { data, error } = await supabase
      .from("challenges")
      .insert({
        code: normalizedCode,
        public_name: name.trim(),
        reference_year: referenceYear,
        reference_month: referenceMonth,
        sports_starts_at: toIsoLocal(startsAt),
        sports_ends_at: toIsoLocal(endsAt),
        timezone: "America/Fortaleza",
        status: "DRAFT",
        is_public: false,
      })
      .select("id")
      .single();

    if (error) {
      setMessage(
        error.code === "23505"
          ? "Já existe um desafio com esse código."
          : "Não foi possível salvar o desafio.",
      );
      setBusy(false);
      return;
    }

    await supabase.rpc("write_audit_event", {
      event_action: "challenge.created",
      event_application_version: "challenges-cycle-1",
      event_metadata: { code: normalizedCode },
      event_outcome: "success",
      event_reason: null,
      event_request_id: crypto.randomUUID(),
      event_resource_type: "challenge",
    });

    setName("");
    setCode("");
    setStartsAt("");
    setEndsAt("");
    setShowForm(false);
    await loadChallenges(data.id);
    setMessage("Desafio criado em rascunho.");
  }

  async function createGoal(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || !selected) return;
    const targetKm = Number(goalKm);
    if (!Number.isInteger(targetKm) || targetKm <= 0) {
      setMessage("Informe uma meta de quilômetros válida.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("challenge_goals").insert({
      challenge_id: selected.id,
      target_km: targetKm,
      public_label: goalLabel.trim() || `${targetKm} km`,
      display_order: goals.length,
      is_active: true,
    });

    if (error) {
      setMessage(
        error.code === "23505"
          ? "Essa meta já está cadastrada neste desafio."
          : "Não foi possível cadastrar a meta.",
      );
      setBusy(false);
      return;
    }

    setGoalKm("");
    setGoalLabel("");
    setShowGoalForm(false);
    await loadChallengeDetails(selected.id);
    setMessage("Meta adicionada ao desafio.");
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
        category_code: offerCategory
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, "_"),
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
    setOfferCategory("NORMAL");
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
        Cadastre a edição e, em seguida, configure metas e ofertas de inscrição
        dentro dela.
      </p>

      {showForm ? (
        <form className="challenge-form" onSubmit={createChallenge}>
          <label>
            Nome público
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Desafio Giro Agosto 2026"
              required
              minLength={2}
            />
          </label>
          <label>
            Código interno
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ex.: agosto-2026"
              required
              pattern="[A-Za-z0-9_-]+"
            />
          </label>
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

          <div className="challenge-config-grid">
            <section className="config-card">
              <div className="section-heading">
                <div>
                  <h3>Metas</h3>
                  <p className="mini-description">
                    Quilometragens disponíveis nesta edição.
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="compact"
                    onClick={() => setShowGoalForm((value) => !value)}
                    disabled={busy}
                  >
                    {showGoalForm ? "Cancelar" : "Adicionar meta"}
                  </button>
                ) : null}
              </div>

              {showGoalForm ? (
                <form className="compact-form" onSubmit={createGoal}>
                  <div className="form-grid two">
                    <label>
                      Quilômetros
                      <input
                        type="number"
                        min={1}
                        value={goalKm}
                        onChange={(event) => setGoalKm(event.target.value)}
                        placeholder="300"
                        required
                      />
                    </label>
                    <label>
                      Nome exibido
                      <input
                        value={goalLabel}
                        onChange={(event) => setGoalLabel(event.target.value)}
                        placeholder="300 km"
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit" disabled={busy}>
                      Salvar meta
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="simple-list">
                {goals.map((goal) => (
                  <div className="simple-row" key={goal.id}>
                    <strong>
                      {goal.public_label || `${goal.target_km} km`}
                    </strong>
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
                    Preço, prazo, limite e metas disponíveis.
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
                        onChange={(event) =>
                          setOfferInternalName(event.target.value)
                        }
                        placeholder="Normal agosto"
                        required
                        minLength={2}
                      />
                    </label>
                    <label>
                      Nome para o público
                      <input
                        value={offerPublicName}
                        onChange={(event) =>
                          setOfferPublicName(event.target.value)
                        }
                        placeholder="Inscrição Agosto"
                        required
                        minLength={2}
                      />
                    </label>
                  </div>
                  <div className="form-grid two">
                    <label>
                      Categoria
                      <input
                        value={offerCategory}
                        onChange={(event) =>
                          setOfferCategory(event.target.value)
                        }
                        placeholder="NORMAL"
                        required
                      />
                    </label>
                    <label>
                      Valor (R$)
                      <input
                        inputMode="decimal"
                        value={offerPrice}
                        onChange={(event) => setOfferPrice(event.target.value)}
                        placeholder="44,90"
                        required
                      />
                    </label>
                  </div>
                  <div className="form-grid two">
                    <label>
                      Início das inscrições
                      <input
                        type="datetime-local"
                        value={offerStartsAt}
                        onChange={(event) =>
                          setOfferStartsAt(event.target.value)
                        }
                        required
                      />
                    </label>
                    <label>
                      Fim das inscrições
                      <input
                        type="datetime-local"
                        value={offerEndsAt}
                        onChange={(event) => setOfferEndsAt(event.target.value)}
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
                      onChange={(event) => setOfferLimit(event.target.value)}
                      required
                    />
                  </label>
                  <fieldset className="goal-picker">
                    <legend>Metas disponíveis nesta oferta</legend>
                    {goals
                      .filter((goal) => goal.is_active)
                      .map((goal) => (
                        <label className="check-row" key={goal.id}>
                          <input
                            type="checkbox"
                            checked={offerGoalIds.includes(goal.id)}
                            onChange={() => toggleOfferGoal(goal.id)}
                          />
                          <span>
                            {goal.public_label || `${goal.target_km} km`}
                          </span>
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
