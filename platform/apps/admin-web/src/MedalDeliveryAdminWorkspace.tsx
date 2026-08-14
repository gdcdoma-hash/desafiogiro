import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

type Delivery = {
  id: string;
  challenge_id: string;
  participant_name: string;
  participant_city: string;
  participant_state_code: string | null;
  challenge_name: string;
  target_km: number;
  status:
    | "PENDING"
    | "ASSIGNED"
    | "IN_TRANSIT"
    | "AWAITING_CONFIRMATION"
    | "CONFIRMED"
    | "ISSUE_REPORTED"
    | "CANCELLED";
};

type Batch = {
  id: string;
  challenge_id: string;
  label: string;
  method: "EVENT" | "STORE_PICKUP" | "POSTAL" | "OTHER";
  status: "PREPARING" | "HANDED_OFF" | "CLOSED" | "CANCELLED";
};

const statusLabel: Record<Delivery["status"], string> = {
  PENDING: "Pendente",
  ASSIGNED: "Separada em lote",
  IN_TRANSIT: "Em trânsito",
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmada",
  ISSUE_REPORTED: "Problema informado",
  CANCELLED: "Cancelada",
};

export function MedalDeliveryAdminWorkspace({ supabase, canManage }: Props) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchByDelivery, setBatchByDelivery] = useState<Record<string, string>>({});
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [evidence, setEvidence] = useState("");
  const [noteByDelivery, setNoteByDelivery] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [deliveryResult, batchResult] = await Promise.all([
      supabase
        .from("medal_delivery_overview")
        .select("id,challenge_id,participant_name,participant_city,participant_state_code,challenge_name,target_km,status")
        .in("status", ["PENDING", "ASSIGNED", "IN_TRANSIT", "AWAITING_CONFIRMATION", "ISSUE_REPORTED"])
        .order("participant_name", { ascending: true }),
      supabase
        .from("medal_delivery_batches")
        .select("id,challenge_id,label,method,status")
        .in("status", ["PREPARING", "HANDED_OFF"])
        .order("created_at", { ascending: false }),
    ]);

    setDeliveries((deliveryResult.data ?? []) as Delivery[]);
    setBatches((batchResult.data ?? []) as Batch[]);
  }

  useEffect(() => {
    void load();
  }, []);

  const preparingBatches = useMemo(
    () => batches.filter((batch) => batch.status === "PREPARING"),
    [batches],
  );

  async function assign(delivery: Delivery) {
    const batchId = batchByDelivery[delivery.id];
    if (!batchId) return;
    setBusy(true);
    const { error } = await supabase.rpc("assign_medal_delivery_to_batch", {
      target_delivery_id: delivery.id,
      target_batch_id: batchId,
    });
    setMessage(error ? "Não foi possível incluir a medalha no lote." : "Medalha incluída no lote.");
    if (!error) await load();
    setBusy(false);
  }

  async function handoffBatch() {
    if (!selectedBatchId || recipientName.trim().length < 2 || evidence.trim().length < 3) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("handoff_medal_delivery_batch", {
      target_batch_id: selectedBatchId,
      recipient_name: recipientName.trim(),
      evidence: evidence.trim(),
    });
    setMessage(
      error
        ? "Não foi possível registrar o repasse do lote."
        : `Repasse registrado para ${Number(data ?? 0)} medalha(s).`,
    );
    if (!error) {
      setRecipientName("");
      setEvidence("");
      setSelectedBatchId("");
      await load();
    }
    setBusy(false);
  }

  async function confirm(delivery: Delivery) {
    setBusy(true);
    const { error } = await supabase.rpc("confirm_medal_delivery_receipt", {
      target_delivery_id: delivery.id,
      confirmation_note: noteByDelivery[delivery.id]?.trim() ?? "",
    });
    setMessage(error ? "Não foi possível confirmar o recebimento." : "Recebimento confirmado.");
    if (!error) await load();
    setBusy(false);
  }

  async function reportIssue(delivery: Delivery) {
    const note = noteByDelivery[delivery.id]?.trim() ?? "";
    if (note.length < 5) {
      setMessage("Descreva o problema antes de registrar a ocorrência.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("report_medal_delivery_issue", {
      target_delivery_id: delivery.id,
      issue_description: note,
    });
    setMessage(error ? "Não foi possível registrar a ocorrência." : "Ocorrência registrada.");
    if (!error) await load();
    setBusy(false);
  }

  async function resume(delivery: Delivery) {
    const note = noteByDelivery[delivery.id]?.trim() ?? "";
    if (note.length < 5) {
      setMessage("Informe como o problema foi resolvido.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("resume_medal_delivery_confirmation", {
      target_delivery_id: delivery.id,
      resolution_note: note,
    });
    setMessage(error ? "Não foi possível concluir a resolução." : "Problema resolvido; entrega voltou para confirmação.");
    if (!error) await load();
    setBusy(false);
  }

  if (!canManage) return null;

  return (
    <section className="audit-panel" aria-labelledby="medal-delivery-actions-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Logística</p>
          <h2 id="medal-delivery-actions-title">Ações de entrega</h2>
        </div>
        <button type="button" className="compact" disabled={busy} onClick={() => void load()}>
          Atualizar
        </button>
      </div>
      <p className="section-description">
        Separe medalhas em lotes, registre quem recebeu a sacola e mantenha a confirmação de cada atleta acompanhada.
      </p>
      <p role="status" className="status">{message}</p>

      <details>
        <summary>Registrar repasse de um lote</summary>
        <label>
          Lote em preparação
          <select value={selectedBatchId} onChange={(event) => setSelectedBatchId(event.target.value)}>
            <option value="">Selecione</option>
            {preparingBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.label}</option>
            ))}
          </select>
        </label>
        <label>
          Pessoa que recebeu o lote
          <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
        </label>
        <label>
          Evidência do repasse
          <input
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="Ex.: entregue no evento, foto/registro interno, protocolo"
          />
        </label>
        <button type="button" disabled={busy || !selectedBatchId} onClick={() => void handoffBatch()}>
          Confirmar repasse do lote
        </button>
      </details>

      <div className="audit-list">
        {deliveries.map((delivery) => {
          const compatibleBatches = preparingBatches.filter(
            (batch) => batch.challenge_id === delivery.challenge_id,
          );
          return (
            <article className="audit-item" key={delivery.id}>
              <div>
                <strong>{delivery.participant_name}</strong>
                <span>
                  {delivery.participant_city}
                  {delivery.participant_state_code ? ` - ${delivery.participant_state_code}` : ""} · {delivery.challenge_name} · {delivery.target_km} km
                </span>
                <span>{statusLabel[delivery.status]}</span>

                {delivery.status === "PENDING" ? (
                  <>
                    <select
                      value={batchByDelivery[delivery.id] ?? ""}
                      onChange={(event) =>
                        setBatchByDelivery((current) => ({ ...current, [delivery.id]: event.target.value }))
                      }
                    >
                      <option value="">Selecione o lote</option>
                      {compatibleBatches.map((batch) => (
                        <option key={batch.id} value={batch.id}>{batch.label}</option>
                      ))}
                    </select>
                    <button type="button" disabled={busy || !batchByDelivery[delivery.id]} onClick={() => void assign(delivery)}>
                      Incluir no lote
                    </button>
                  </>
                ) : null}

                {delivery.status === "IN_TRANSIT" || delivery.status === "AWAITING_CONFIRMATION" || delivery.status === "ISSUE_REPORTED" ? (
                  <>
                    <input
                      value={noteByDelivery[delivery.id] ?? ""}
                      onChange={(event) =>
                        setNoteByDelivery((current) => ({ ...current, [delivery.id]: event.target.value }))
                      }
                      placeholder={delivery.status === "ISSUE_REPORTED" ? "Informe a resolução" : "Observação ou problema informado"}
                    />
                    {delivery.status === "AWAITING_CONFIRMATION" ? (
                      <button type="button" disabled={busy} onClick={() => void confirm(delivery)}>Confirmar recebimento</button>
                    ) : null}
                    {delivery.status === "IN_TRANSIT" || delivery.status === "AWAITING_CONFIRMATION" ? (
                      <button type="button" className="secondary" disabled={busy} onClick={() => void reportIssue(delivery)}>Registrar problema</button>
                    ) : null}
                    {delivery.status === "ISSUE_REPORTED" ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => void resume(delivery)}>Problema resolvido</button>
                        <button type="button" className="secondary" disabled={busy} onClick={() => void confirm(delivery)}>Confirmar recebimento</button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
