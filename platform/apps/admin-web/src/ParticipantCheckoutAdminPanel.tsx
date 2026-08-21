import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type CheckoutRow = {
  checkout_id: string;
  participant_id: string;
  participant_name: string;
  status: "SUBMITTED" | "CONFIRMED" | "CANCELLED";
  item_count: number;
  total_amount: number | string;
  pix_key_snapshot: string | null;
  submitted_at: string | null;
  created_at: string;
  proof_object_path: string | null;
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ParticipantCheckoutAdminPanel({
  supabase,
  canManage,
}: {
  supabase: SupabaseClient;
  canManage: boolean;
}) {
  const [rows, setRows] = useState<CheckoutRow[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.rpc(
      "get_participant_checkout_admin_queue",
    );
    if (error) {
      setRows([]);
      setMessage("Não foi possível carregar os pagamentos agrupados.");
    } else {
      const next = (data ?? []) as CheckoutRow[];
      setRows(next);
      setMessage(
        next.length
          ? `${next.length} pagamento(s) agrupado(s) mais recente(s).`
          : "Nenhum pagamento agrupado enviado ainda.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openProof(row: CheckoutRow) {
    if (!row.proof_object_path) {
      setMessage("Este checkout não possui comprovante anexado.");
      return;
    }
    setBusyId(row.checkout_id);
    const { data, error } = await supabase.storage
      .from("participant-registration-media")
      .createSignedUrl(row.proof_object_path, 300);
    if (error || !data?.signedUrl) {
      setMessage("Não foi possível abrir o comprovante agora.");
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      setMessage("Comprovante aberto em uma nova aba.");
    }
    setBusyId(null);
  }

  async function act(row: CheckoutRow, action: "confirm" | "cancel") {
    if (!canManage || row.status !== "SUBMITTED") return;
    setBusyId(row.checkout_id);
    const rpc =
      action === "confirm"
        ? "confirm_participant_checkout_payment"
        : "cancel_participant_checkout_payment";
    const { error } = await supabase.rpc(rpc, {
      target_checkout_id: row.checkout_id,
    });
    if (error) {
      setMessage(
        action === "confirm"
          ? "Não foi possível confirmar o conjunto. Verifique estoque e configuração."
          : "Não foi possível cancelar o conjunto agora.",
      );
    } else {
      setMessage(
        action === "confirm"
          ? "Pagamento confirmado e todas as inscrições do conjunto foram confirmadas."
          : "Checkout cancelado e reservas liberadas.",
      );
      await load();
    }
    setBusyId(null);
  }

  return (
    <section className="participant-checkout-admin">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Pagamentos do Portal</p>
          <h3>Inscrições agrupadas</h3>
        </div>
        <button type="button" className="compact" onClick={() => void load()}>
          Atualizar
        </button>
      </div>
      <p className="section-description">
        Quando o participante paga várias inscrições de uma vez, a conferência
        é feita neste conjunto para evitar confirmações parciais.
      </p>
      <p role="status" className="status">
        {message}
      </p>

      <div className="audit-list">
        {rows.map((row) => (
          <article className="audit-item payment-item" key={row.checkout_id}>
            <div className="payment-main">
              <strong>{row.participant_name}</strong>
              <span>
                {row.item_count} {row.item_count === 1 ? "inscrição" : "inscrições"} · {formatMoney(row.total_amount)}
              </span>
              <span>
                {row.status === "SUBMITTED"
                  ? "Aguardando conferência"
                  : row.status === "CONFIRMED"
                    ? "Confirmado"
                    : "Cancelado"}
              </span>
              <time dateTime={row.submitted_at ?? row.created_at}>
                Enviado em {formatDate(row.submitted_at ?? row.created_at)}
              </time>
            </div>
            <div className="audit-meta payment-meta">
              {row.proof_object_path ? (
                <button
                  type="button"
                  className="compact secondary"
                  disabled={busyId === row.checkout_id}
                  onClick={() => void openProof(row)}
                >
                  Ver comprovante
                </button>
              ) : null}
              {canManage && row.status === "SUBMITTED" ? (
                <div className="payment-actions">
                  <button
                    type="button"
                    className="compact"
                    disabled={busyId === row.checkout_id}
                    onClick={() => void act(row, "confirm")}
                  >
                    Confirmar conjunto
                  </button>
                  <button
                    type="button"
                    className="compact secondary"
                    disabled={busyId === row.checkout_id}
                    onClick={() => void act(row, "cancel")}
                  >
                    Cancelar conjunto
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
