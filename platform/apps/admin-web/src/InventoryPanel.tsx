import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

type Challenge = { id: string; public_name: string };
type Goal = {
  id: string;
  challenge_id: string;
  public_label: string | null;
  target_km: number;
};
type InventoryItem = {
  inventory_item_id: string;
  challenge_id: string;
  goal_id: string | null;
  code: string;
  public_name: string;
  status: string;
  balance: number;
};
type InventoryMovement = {
  id: string;
  inventory_item_id: string;
  movement_type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  reason_code: string;
  notes: string;
  occurred_at: string;
};

export function InventoryPanel({ supabase, canManage }: Props) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [movementItemId, setMovementItemId] = useState("");
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "ADJUSTMENT">(
    "IN",
  );
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [movementNotes, setMovementNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const [c, g, i, m] = await Promise.all([
      supabase
        .from("challenges")
        .select("id,public_name")
        .order("sports_starts_at", { ascending: false }),
      supabase
        .from("challenge_goals")
        .select("id,challenge_id,public_label,target_km")
        .eq("is_active", true),
      supabase
        .from("inventory_balances")
        .select(
          "inventory_item_id,challenge_id,goal_id,code,public_name,status,balance",
        )
        .order("public_name"),
      supabase
        .from("inventory_movements")
        .select(
          "id,inventory_item_id,movement_type,quantity,reason_code,notes,occurred_at",
        )
        .order("occurred_at", { ascending: false })
        .limit(100),
    ]);

    if (c.error || g.error || i.error || m.error) {
      setMessage("Não foi possível carregar o estoque agora.");
    } else {
      setChallenges((c.data ?? []) as Challenge[]);
      setGoals((g.data ?? []) as Goal[]);
      setItems((i.data ?? []) as InventoryItem[]);
      setMovements((m.data ?? []) as InventoryMovement[]);
      setMessage(
        i.data?.length
          ? `${i.data.length} itens de estoque.`
          : "Nenhum item de estoque cadastrado.",
      );
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const challengeGoals = useMemo(
    () => goals.filter((goal) => goal.challenge_id === challengeId),
    [goals, challengeId],
  );

  const selectedMovementItem = useMemo(
    () =>
      items.find((item) => item.inventory_item_id === movementItemId) ?? null,
    [items, movementItemId],
  );

  function itemName(itemId: string) {
    return (
      items.find((item) => item.inventory_item_id === itemId)?.public_name ??
      "Item de estoque"
    );
  }

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    const initialQuantity = Number.parseInt(quantity, 10);
    if (
      !challengeId ||
      !name.trim() ||
      !code.trim() ||
      Number.isNaN(initialQuantity) ||
      initialQuantity < 0
    ) {
      setMessage(
        "Preencha desafio, nome, código e uma quantidade inicial válida.",
      );
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        challenge_id: challengeId,
        goal_id: goalId || null,
        code: code
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-"),
        public_name: name.trim(),
      })
      .select("id")
      .single();

    if (error || !data) {
      setMessage("Não foi possível cadastrar o item de estoque.");
      setBusy(false);
      return;
    }

    if (initialQuantity > 0) {
      const movement = await supabase.from("inventory_movements").insert({
        inventory_item_id: data.id,
        movement_type: "IN",
        quantity: initialQuantity,
        reason_code: "INITIAL_STOCK",
      });
      if (movement.error) {
        setMessage("Item criado, mas o saldo inicial não pôde ser registrado.");
        setBusy(false);
        await load();
        return;
      }
    }

    setChallengeId("");
    setGoalId("");
    setName("");
    setCode("");
    setQuantity("0");
    setMessage("Item de estoque criado.");
    await load();
    setBusy(false);
  }

  async function createMovement(event: React.FormEvent) {
    event.preventDefault();
    const typedQuantity = Number.parseInt(movementQuantity, 10);
    if (
      !selectedMovementItem ||
      Number.isNaN(typedQuantity) ||
      typedQuantity === 0
    ) {
      setMessage(
        "Selecione um item e informe uma quantidade diferente de zero.",
      );
      return;
    }

    let storedQuantity = typedQuantity;
    if (movementType === "IN") storedQuantity = Math.abs(typedQuantity);
    if (movementType === "OUT") storedQuantity = -Math.abs(typedQuantity);

    if (
      movementType === "OUT" &&
      Math.abs(storedQuantity) > Number(selectedMovementItem.balance)
    ) {
      setMessage("A saída informada é maior que o saldo disponível.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("inventory_movements").insert({
      inventory_item_id: selectedMovementItem.inventory_item_id,
      movement_type: movementType,
      quantity: storedQuantity,
      reason_code: "MANUAL",
      notes: movementNotes.trim(),
    });

    if (error) {
      setMessage("Não foi possível registrar a movimentação de estoque.");
    } else {
      setMovementQuantity("1");
      setMovementNotes("");
      setMessage("Movimentação registrada.");
      await load();
    }
    setBusy(false);
  }

  return (
    <section className="audit-panel" aria-labelledby="inventory-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operação</p>
          <h2 id="inventory-title">Estoque</h2>
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
        Controle por movimentos. O saldo é calculado pelo histórico de entradas,
        saídas e ajustes.
      </p>
      <p role="status" className="status">
        {message}
      </p>

      {canManage ? (
        <>
          <form onSubmit={createItem}>
            <label>
              Desafio
              <select
                value={challengeId}
                onChange={(event) => {
                  setChallengeId(event.target.value);
                  setGoalId("");
                }}
                required
              >
                <option value="">Selecione</option>
                {challenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.public_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Meta relacionada
              <select
                value={goalId}
                onChange={(event) => setGoalId(event.target.value)}
                disabled={!challengeId}
              >
                <option value="">Sem meta específica</option>
                {challengeGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.public_label ?? `${goal.target_km} km`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nome do item
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Medalha 300 km"
                required
              />
            </label>
            <label>
              Código interno
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="medal-300"
                required
              />
            </label>
            <label>
              Quantidade inicial
              <input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              Cadastrar item
            </button>
          </form>

          <form onSubmit={createMovement}>
            <h3>Nova movimentação</h3>
            <label>
              Item
              <select
                value={movementItemId}
                onChange={(event) => setMovementItemId(event.target.value)}
                required
              >
                <option value="">Selecione</option>
                {items
                  .filter((item) => item.status === "ACTIVE")
                  .map((item) => (
                    <option
                      key={item.inventory_item_id}
                      value={item.inventory_item_id}
                    >
                      {item.public_name} · saldo {item.balance}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={movementType}
                onChange={(event) =>
                  setMovementType(
                    event.target.value as "IN" | "OUT" | "ADJUSTMENT",
                  )
                }
              >
                <option value="IN">Entrada</option>
                <option value="OUT">Saída</option>
                <option value="ADJUSTMENT">Ajuste</option>
              </select>
            </label>
            <label>
              Quantidade
              <input
                type="number"
                step="1"
                value={movementQuantity}
                onChange={(event) => setMovementQuantity(event.target.value)}
                required
              />
            </label>
            <label>
              Observação
              <input
                value={movementNotes}
                onChange={(event) => setMovementNotes(event.target.value)}
                placeholder="Motivo ou referência opcional"
              />
            </label>
            <button type="submit" disabled={busy || !selectedMovementItem}>
              Registrar movimentação
            </button>
          </form>
        </>
      ) : null}

      {items.length > 0 ? (
        <div className="audit-list">
          {items.map((item) => (
            <article className="audit-item" key={item.inventory_item_id}>
              <div>
                <strong>{item.public_name}</strong>
                <span>{item.code}</span>
              </div>
              <div className="audit-meta">
                <span>{item.status}</span>
                <span>{item.balance} un.</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {movements.length > 0 ? (
        <div className="audit-list">
          <h3>Movimentações recentes</h3>
          {movements.map((movement) => (
            <article className="audit-item" key={movement.id}>
              <div>
                <strong>{itemName(movement.inventory_item_id)}</strong>
                <span>
                  {movement.movement_type} · {movement.quantity > 0 ? "+" : ""}
                  {movement.quantity} un.
                </span>
                {movement.notes ? <span>{movement.notes}</span> : null}
              </div>
              <div className="audit-meta">
                <span>{movement.reason_code}</span>
                <span>
                  {new Date(movement.occurred_at).toLocaleString("pt-BR")}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
