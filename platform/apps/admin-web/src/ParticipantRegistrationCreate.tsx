import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type CatalogItem = {
  challenge_id: string;
  challenge_name: string;
  short_description: string;
  reference_year: number;
  reference_month: number;
  offer_id: string;
  offer_name: string;
  price: number | string;
  goal_id: string;
  goal_label: string;
  target_km: number;
  display_order: number;
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export function ParticipantRegistrationCreate({
  supabase,
  onCreated,
}: {
  supabase: SupabaseClient;
  onCreated: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [offerId, setOfferId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [message, setMessage] = useState("Carregando desafios disponíveis…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadCatalog() {
      const { data, error } = await supabase.rpc(
        "get_participant_registration_catalog",
      );
      if (error) {
        setCatalog([]);
        setMessage("Não foi possível carregar os desafios disponíveis agora.");
        return;
      }
      const rows = (data ?? []) as CatalogItem[];
      setCatalog(rows);
      setOfferId(rows[0]?.offer_id ?? "");
      setGoalId(rows[0]?.goal_id ?? "");
      setMessage(
        rows.length
          ? "Escolha o desafio e a meta."
          : "Você não possui outra inscrição disponível no momento.",
      );
    }

    void loadCatalog();
  }, [supabase]);

  const offers = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of catalog) {
      if (!map.has(item.offer_id)) map.set(item.offer_id, item);
    }
    return [...map.values()];
  }, [catalog]);

  const goals = useMemo(
    () => catalog.filter((item) => item.offer_id === offerId),
    [catalog, offerId],
  );

  const selected = catalog.find(
    (item) => item.offer_id === offerId && item.goal_id === goalId,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!offerId || !goalId) return;
    setBusy(true);
    setMessage("Criando sua inscrição…");
    const { error } = await supabase.rpc("create_participant_registration", {
      target_offer_id: offerId,
      target_goal_id: goalId,
      target_referral_code: null,
    });
    if (error) {
      setMessage(
        error.message.includes("registration limit")
          ? "Esta inscrição não está mais disponível para sua conta."
          : "Não foi possível criar a inscrição agora.",
      );
      setBusy(false);
      return;
    }
    setMessage("Inscrição criada. O pagamento ficou pendente de confirmação.");
    await onCreated();
    setBusy(false);
  }

  if (catalog.length === 0) {
    return (
      <p role="status" className="status">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <label>
        Desafio
        <select
          value={offerId}
          onChange={(event) => {
            const nextOffer = event.target.value;
            const firstGoal = catalog.find(
              (item) => item.offer_id === nextOffer,
            );
            setOfferId(nextOffer);
            setGoalId(firstGoal?.goal_id ?? "");
          }}
          disabled={busy || offers.length === 0}
        >
          {offers.map((offer) => (
            <option key={offer.offer_id} value={offer.offer_id}>
              {offer.challenge_name} — {offer.offer_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Meta
        <select
          value={goalId}
          onChange={(event) => setGoalId(event.target.value)}
          disabled={busy || goals.length === 0}
        >
          {goals.map((goal) => (
            <option key={goal.goal_id} value={goal.goal_id}>
              {goal.goal_label}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <p>
          Valor da inscrição: <strong>{formatMoney(selected.price)}</strong>
        </p>
      ) : null}
      <button type="submit" disabled={busy || !selected}>
        {busy ? "Criando…" : "Confirmar nova inscrição"}
      </button>
      <p role="status" className="status">
        {message}
      </p>
    </form>
  );
}
