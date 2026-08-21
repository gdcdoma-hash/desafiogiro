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
  category_code: string;
  price: number | string;
  goal_id: string;
  goal_label: string;
  target_km: number;
  display_order: number;
  reserve_on_add: boolean;
  available_balance: number | string;
  category_limit: number;
  category_used: number;
};

type CheckoutItem = {
  registration_id: string;
  offer_id: string;
  challenge_id: string;
  challenge_name: string;
  goal_id: string;
  goal_label: string;
  target_km: number;
  category_code: string;
  price: number | string;
  reservation_status: string | null;
};

type CheckoutState = {
  checkout_id: string;
  status: string;
  item_count: number;
  total_amount: number | string;
  pix_key: string | null;
  pix_holder: string | null;
  expires_at: string;
  items: CheckoutItem[];
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  return "jpg";
}

function categoryLabel(categoryCode: string) {
  if (categoryCode === "NORMAL") return "Normal";
  if (categoryCode === "REPESCAGEM") return "Repescagem";
  if (categoryCode === "TESTE_FLUXO") return "Repescagem de teste";
  return categoryCode
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function ParticipantRegistrationCreate({
  supabase,
  onCreated,
}: {
  supabase: SupabaseClient;
  onCreated: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [offerId, setOfferId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("Carregando inscrições disponíveis…");
  const [busy, setBusy] = useState(false);
  const [editingRegistrationId, setEditingRegistrationId] = useState<
    string | null
  >(null);
  const [editOfferId, setEditOfferId] = useState("");
  const [editGoalId, setEditGoalId] = useState("");

  async function loadCatalog() {
    const { data, error } = await supabase.rpc(
      "get_participant_checkout_catalog",
    );
    if (error) throw error;
    const rows = (data ?? []) as CatalogItem[];
    setCatalog(rows);
    setOfferId((current) => {
      if (current && rows.some((row) => row.offer_id === current)) {
        return current;
      }
      return rows[0]?.offer_id ?? "";
    });
    setGoalId((current) => {
      if (current && rows.some((row) => row.goal_id === current)) {
        return current;
      }
      return rows[0]?.goal_id ?? "";
    });
    return rows;
  }

  async function loadCheckout() {
    const { data, error } = await supabase.rpc(
      "get_participant_checkout_state",
      {
        target_checkout_id: null,
      },
    );
    if (error) throw error;
    const next = data as CheckoutState;
    setCheckout(next);
    return next;
  }

  async function refresh() {
    const nextCheckout = await loadCheckout();
    const rows = await loadCatalog();
    if (nextCheckout.item_count > 0) {
      setMessage("Revise suas inscrições, faça o PIX e envie o comprovante.");
    } else if (rows.length > 0) {
      setMessage("Adicione as inscrições que deseja fazer.");
    } else {
      setMessage("Você não possui outra inscrição disponível no momento.");
    }
  }

  useEffect(() => {
    void refresh().catch(() => {
      setCatalog([]);
      setMessage("Não foi possível carregar as inscrições disponíveis agora.");
    });
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

  const editGoals = useMemo(
    () => catalog.filter((item) => item.offer_id === editOfferId),
    [catalog, editOfferId],
  );

  async function mutateCheckout(
    rpcName:
      | "add_participant_checkout_item"
      | "remove_participant_checkout_item"
      | "swap_participant_checkout_item",
    args: Record<string, string>,
    progressMessage: string,
  ) {
    if (!checkout) return;
    setBusy(true);
    setMessage(progressMessage);
    try {
      const { data, error } = await supabase.rpc(rpcName, args);
      if (error) throw error;
      setCheckout(data as CheckoutState);
      await loadCatalog();
      setEditingRegistrationId(null);
      setMessage("Inscrições atualizadas. Confira o resumo abaixo.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      if (
        text.includes("not available") ||
        text.includes("no longer available")
      ) {
        setMessage(
          "Essa medalha não está mais disponível. Sua seleção anterior foi mantida.",
        );
      } else if (text.includes("limit reached")) {
        setMessage(
          "Você já atingiu o limite configurado para esse tipo de inscrição.",
        );
      } else if (
        text.includes("No active price lot") ||
        text.includes("PIX key")
      ) {
        setMessage(
          "A combinação de quantidade e valor ainda não está configurada pelo administrador.",
        );
      } else {
        setMessage(
          "Não foi possível atualizar as inscrições agora. Nenhuma seleção existente foi perdida.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    if (!checkout || !selected) return;
    await mutateCheckout(
      "add_participant_checkout_item",
      {
        target_checkout_id: checkout.checkout_id,
        target_offer_id: selected.offer_id,
        target_goal_id: selected.goal_id,
      },
      selected.reserve_on_add
        ? "Garantindo sua medalha no estoque…"
        : "Adicionando inscrição…",
    );
  }

  async function removeItem(item: CheckoutItem) {
    if (!checkout) return;
    await mutateCheckout(
      "remove_participant_checkout_item",
      {
        target_checkout_id: checkout.checkout_id,
        target_registration_id: item.registration_id,
      },
      "Removendo inscrição…",
    );
  }

  function beginEdit(item: CheckoutItem) {
    setEditingRegistrationId(item.registration_id);
    const availableSameOffer = catalog.find(
      (row) => row.offer_id === item.offer_id,
    );
    const first = availableSameOffer ?? catalog[0];
    setEditOfferId(first?.offer_id ?? item.offer_id);
    const sameGoal = catalog.find(
      (row) =>
        row.offer_id === (first?.offer_id ?? item.offer_id) &&
        row.goal_id === item.goal_id,
    );
    setEditGoalId(sameGoal?.goal_id ?? first?.goal_id ?? item.goal_id);
  }

  async function swapItem(item: CheckoutItem) {
    if (!checkout || !editOfferId || !editGoalId) return;
    await mutateCheckout(
      "swap_participant_checkout_item",
      {
        target_checkout_id: checkout.checkout_id,
        target_registration_id: item.registration_id,
        target_offer_id: editOfferId,
        target_goal_id: editGoalId,
      },
      "Verificando a nova medalha antes de trocar…",
    );
  }

  async function copyPixKey() {
    if (!checkout?.pix_key) return;
    await navigator.clipboard.writeText(checkout.pix_key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function uploadCheckoutMedia(
    userId: string,
    checkoutId: string,
    kind: "AVATAR" | "PAYMENT_PROOF",
    file: File,
  ) {
    const label = kind === "AVATAR" ? "avatar" : "comprovante";
    const objectPath = `${userId}/checkout/${checkoutId}/${label}.${extensionFor(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("participant-registration-media")
      .upload(objectPath, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const { error: attachError } = await supabase.rpc(
      "attach_participant_checkout_media",
      {
        target_checkout_id: checkoutId,
        target_kind: kind,
        target_object_path: objectPath,
        target_mime_type: file.type || "application/octet-stream",
        target_original_name: file.name,
      },
    );
    if (attachError) throw attachError;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !checkout ||
      checkout.item_count < 1 ||
      !avatarFile ||
      !proofFile ||
      !checkout.pix_key
    ) {
      setMessage(
        "Adicione ao menos uma inscrição, sua foto e o comprovante antes de enviar.",
      );
      return;
    }

    setBusy(true);
    setMessage("Enviando suas inscrições para conferência…");
    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw authError ?? new Error("Sessão inválida");
      }

      await uploadCheckoutMedia(
        authData.user.id,
        checkout.checkout_id,
        "AVATAR",
        avatarFile,
      );
      await uploadCheckoutMedia(
        authData.user.id,
        checkout.checkout_id,
        "PAYMENT_PROOF",
        proofFile,
      );

      const { data, error } = await supabase.rpc(
        "submit_participant_checkout",
        {
          target_checkout_id: checkout.checkout_id,
        },
      );
      if (error) throw error;
      setCheckout(data as CheckoutState);
      setAvatarFile(null);
      setProofFile(null);
      setMessage(
        "Inscrições enviadas. O pagamento e o comprovante estão aguardando conferência da equipe.",
      );
      await onCreated();
    } catch {
      setMessage(
        "Não foi possível concluir o envio. As inscrições e reservas já adicionadas foram preservadas para você tentar novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  const editable = checkout?.status === "DRAFT";

  return (
    <form onSubmit={submit} className="participant-registration-form">
      <div className="registration-step">
        <span className="registration-step-number">1</span>
        <div>
          <strong>Monte suas inscrições</strong>
          <small>
            Adicione Normal e Repescagens dentro dos limites definidos pela
            equipe.
          </small>
        </div>
      </div>

      {checkout && checkout.items.length > 0 ? (
        <div className="registration-cart" aria-label="Inscrições adicionadas">
          {checkout.items.map((item) => (
            <article
              key={item.registration_id}
              className="registration-cart-item"
            >
              <div className="registration-cart-main">
                <span className="registration-category">
                  {categoryLabel(item.category_code)}
                </span>
                <strong>{item.challenge_name}</strong>
                <span>{item.goal_label}</span>
                {item.reservation_status === "RESERVED" ? (
                  <small className="registration-reserved">
                    Medalha reservada ✓
                  </small>
                ) : null}
              </div>
              <strong className="registration-cart-price">
                {formatMoney(item.price)}
              </strong>
              {editable ? (
                <div className="registration-cart-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => beginEdit(item)}
                    disabled={busy}
                  >
                    Alterar
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void removeItem(item)}
                    disabled={busy}
                  >
                    Remover
                  </button>
                </div>
              ) : null}

              {editingRegistrationId === item.registration_id ? (
                <div className="registration-edit-box">
                  <strong>Trocar inscrição</strong>
                  <small>
                    A troca só acontece se a nova opção estiver realmente
                    disponível.
                  </small>
                  <label>
                    Desafio
                    <select
                      value={editOfferId}
                      onChange={(event) => {
                        const nextOffer = event.target.value;
                        const firstGoal = catalog.find(
                          (row) => row.offer_id === nextOffer,
                        );
                        setEditOfferId(nextOffer);
                        setEditGoalId(firstGoal?.goal_id ?? "");
                      }}
                      disabled={busy}
                    >
                      {offers.map((offer) => (
                        <option key={offer.offer_id} value={offer.offer_id}>
                          {categoryLabel(offer.category_code)} —{" "}
                          {offer.challenge_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Meta
                    <select
                      value={editGoalId}
                      onChange={(event) => setEditGoalId(event.target.value)}
                      disabled={busy}
                    >
                      {editGoals.map((goal) => (
                        <option key={goal.goal_id} value={goal.goal_id}>
                          {goal.goal_label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="registration-edit-actions">
                    <button
                      type="button"
                      onClick={() => void swapItem(item)}
                      disabled={busy || !editGoalId}
                    >
                      Garantir e trocar
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditingRegistrationId(null)}
                      disabled={busy}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="participant-note">Nenhuma inscrição adicionada ainda.</p>
      )}

      {editable && catalog.length > 0 ? (
        <div className="registration-add-box">
          <strong>Adicionar inscrição</strong>
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
                  {categoryLabel(offer.category_code)} — {offer.challenge_name}
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
            <div className="registration-add-summary">
              <span>Valor nesta configuração</span>
              <strong>{formatMoney(selected.price)}</strong>
              {selected.reserve_on_add ? (
                <small>
                  Ao adicionar, a medalha será reservada no estoque.
                </small>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void addItem()}
            disabled={busy || !selected}
          >
            {selected?.reserve_on_add
              ? "Adicionar e reservar medalha"
              : "Adicionar inscrição"}
          </button>
        </div>
      ) : null}

      {editable && catalog.length === 0 && checkout?.item_count ? (
        <p className="participant-note">
          Você atingiu os limites das inscrições disponíveis neste momento.
        </p>
      ) : null}

      {checkout && checkout.item_count > 0 ? (
        <>
          <div className="registration-step">
            <span className="registration-step-number">2</span>
            <div>
              <strong>Adicione sua foto</strong>
              <small>
                Uma foto nítida será usada nos materiais das suas inscrições.
              </small>
            </div>
          </div>

          <label className="registration-upload">
            <span>{avatarFile ? "Trocar foto" : "Adicionar foto"}</span>
            <small>{avatarFile ? avatarFile.name : "JPG, PNG ou WEBP"}</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setAvatarFile(event.target.files?.[0] ?? null)
              }
              disabled={busy || !editable}
            />
          </label>

          <div className="registration-step">
            <span className="registration-step-number">3</span>
            <div>
              <strong>Faça o pagamento</strong>
              <small>
                O valor e a chave PIX abaixo correspondem ao conjunto inteiro de
                inscrições.
              </small>
            </div>
          </div>

          <div className="registration-payment-card">
            <span>
              {checkout.item_count}{" "}
              {checkout.item_count === 1 ? "inscrição" : "inscrições"}
            </span>
            <strong>Total: {formatMoney(checkout.total_amount)}</strong>
            {checkout.pix_key ? (
              <>
                <small>{checkout.pix_holder}</small>
                <code>{checkout.pix_key}</code>
                <button
                  type="button"
                  onClick={() => void copyPixKey()}
                  disabled={busy || !editable}
                >
                  {copied ? "Chave copiada ✓" : "Copiar chave PIX"}
                </button>
              </>
            ) : (
              <p className="status">
                Chave PIX ainda não configurada para esta quantidade.
              </p>
            )}
          </div>

          <div className="registration-step">
            <span className="registration-step-number">4</span>
            <div>
              <strong>Envie o comprovante</strong>
              <small>
                Um único comprovante corresponde ao pagamento total acima.
              </small>
            </div>
          </div>

          <label className="registration-upload">
            <span>
              {proofFile ? "Trocar comprovante" : "Enviar comprovante"}
            </span>
            <small>
              {proofFile ? proofFile.name : "Imagem ou PDF, até 10 MB"}
            </small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) =>
                setProofFile(event.target.files?.[0] ?? null)
              }
              disabled={busy || !editable}
            />
          </label>

          {editable ? (
            <button
              type="submit"
              disabled={busy || !avatarFile || !proofFile || !checkout.pix_key}
            >
              {busy ? "Enviando…" : "Enviar inscrições para conferência"}
            </button>
          ) : null}
        </>
      ) : null}

      <p role="status" className="status">
        {message}
      </p>
    </form>
  );
}
