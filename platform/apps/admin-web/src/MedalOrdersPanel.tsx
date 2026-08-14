import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

type PlanningRow = {
  challenge_id: string;
  challenge_name: string;
  goal_id: string;
  goal_label: string;
  suggested_purchase_quantity: number;
};

type OrderRow = {
  medal_order_id: string;
  challenge_id: string;
  challenge_name: string;
  order_reference: string;
  supplier_name: string;
  status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
  ordered_at: string | null;
  expected_at: string | null;
  received_at: string | null;
  item_count: number;
  total_quantity: number;
};

const statusLabel: Record<OrderRow["status"], string> = {
  DRAFT: "Rascunho",
  ORDERED: "Pedido enviado",
  RECEIVED: "Recebido",
  CANCELLED: "Cancelado",
};

export function MedalOrdersPanel({ supabase, canManage }: Props) {
  const [planning, setPlanning] = useState<PlanningRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [reference, setReference] = useState("");
  const [supplier, setSupplier] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    setMessage("");

    const [{ data: planningData, error: planningError }, { data: orderData, error: orderError }] =
      await Promise.all([
        supabase
          .from("medal_purchase_planning")
          .select(
            "challenge_id,challenge_name,goal_id,goal_label,suggested_purchase_quantity",
          )
          .order("challenge_name")
          .order("goal_label"),
        supabase
          .from("medal_orders_overview")
          .select(
            "medal_order_id,challenge_id,challenge_name,order_reference,supplier_name,status,ordered_at,expected_at,received_at,item_count,total_quantity",
          )
          .order("created_at", { ascending: false }),
      ]);

    if (planningError || orderError) {
      setMessage("Não foi possível carregar os pedidos de medalhas.");
    } else {
      setPlanning((planningData ?? []) as PlanningRow[]);
      setOrders((orderData ?? []) as OrderRow[]);
      setMessage("Pedidos e planejamento atualizados.");
    }

    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const challenges = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of planning) map.set(row.challenge_id, row.challenge_name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [planning]);

  const suggestedItems = useMemo(
    () =>
      planning.filter(
        (row) =>
          row.challenge_id === challengeId &&
          Number(row.suggested_purchase_quantity) > 0,
      ),
    [challengeId, planning],
  );

  const suggestedTotal = useMemo(
    () =>
      suggestedItems.reduce(
        (total, row) => total + Number(row.suggested_purchase_quantity),
        0,
      ),
    [suggestedItems],
  );

  async function createSuggestedOrder() {
    if (!canManage || !challengeId || !reference.trim()) return;
    if (suggestedItems.length === 0) {
      setMessage("Não há compra adicional sugerida para este desafio.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { data: order, error: orderError } = await supabase
      .from("medal_orders")
      .insert({
        challenge_id: challengeId,
        order_reference: reference.trim(),
        supplier_name: supplier.trim(),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      setMessage(orderError?.message ?? "Não foi possível criar o pedido.");
      setBusy(false);
      return;
    }

    const { error: itemsError } = await supabase.from("medal_order_items").insert(
      suggestedItems.map((item) => ({
        medal_order_id: order.id,
        goal_id: item.goal_id,
        quantity: Number(item.suggested_purchase_quantity),
      })),
    );

    if (itemsError) {
      await supabase
        .from("medal_orders")
        .update({ status: "CANCELLED" })
        .eq("id", order.id);
      setMessage(
        "O cabeçalho foi criado, mas os itens falharam. O pedido foi cancelado para revisão.",
      );
      setBusy(false);
      await load();
      return;
    }

    setReference("");
    setSupplier("");
    setMessage(`Rascunho criado com ${suggestedTotal} medalhas.`);
    setBusy(false);
    await load();
  }

  async function markOrdered(orderId: string) {
    if (!canManage) return;
    setBusy(true);
    const { error } = await supabase
      .from("medal_orders")
      .update({ status: "ORDERED", ordered_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "DRAFT");

    setMessage(
      error ? error.message : "Pedido marcado como enviado ao fornecedor.",
    );
    setBusy(false);
    await load();
  }

  async function receiveOrder(orderId: string) {
    if (!canManage) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("receive_medal_order", {
      p_medal_order_id: orderId,
    });

    setMessage(
      error
        ? error.message
        : `${Number(data ?? 0)} medalhas recebidas e lançadas no estoque.`,
    );
    setBusy(false);
    await load();
  }

  return (
    <section className="panel-card" aria-labelledby="medal-orders-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Compras e estoque</p>
          <h2 id="medal-orders-title">Pedidos de medalhas</h2>
          <p className="muted">
            Crie um rascunho com base na necessidade calculada, registre o envio
            ao fornecedor e lance o recebimento no estoque.
          </p>
        </div>
        <button
          type="button"
          className="compact"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      <p role="status" className="status">
        {message}
      </p>

      {canManage ? (
        <div className="form-grid">
          <label>
            Desafio
            <select
              value={challengeId}
              onChange={(event) => setChallengeId(event.target.value)}
            >
              <option value="">Selecione</option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {challenge.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Referência do pedido
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Ex.: AGO-2026-01"
            />
          </label>
          <label>
            Fornecedor
            <input
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <div>
            <span className="muted">Sugestão atual</span>
            <strong>{suggestedTotal} medalhas</strong>
          </div>
          <button
            type="button"
            disabled={
              busy || !challengeId || !reference.trim() || suggestedTotal <= 0
            }
            onClick={() => void createSuggestedOrder()}
          >
            Criar rascunho sugerido
          </button>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <p className="muted">Nenhum pedido registrado.</p>
      ) : (
        <div className="audit-list">
          {orders.map((order) => (
            <article className="audit-item" key={order.medal_order_id}>
              <div>
                <strong>{order.order_reference}</strong>
                <span>{order.challenge_name}</span>
                <span>{order.supplier_name || "Fornecedor não informado"}</span>
              </div>
              <div className="audit-meta">
                <span>{statusLabel[order.status]}</span>
                <span>
                  {order.item_count} metas · {order.total_quantity} medalhas
                </span>
                {canManage && order.status === "DRAFT" ? (
                  <button
                    type="button"
                    className="compact"
                    disabled={busy}
                    onClick={() => void markOrdered(order.medal_order_id)}
                  >
                    Marcar como pedido
                  </button>
                ) : null}
                {canManage && order.status === "ORDERED" ? (
                  <button
                    type="button"
                    className="compact"
                    disabled={busy}
                    onClick={() => void receiveOrder(order.medal_order_id)}
                  >
                    Registrar recebimento
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
