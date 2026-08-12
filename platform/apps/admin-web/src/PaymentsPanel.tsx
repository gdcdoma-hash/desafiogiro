import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

type Participant = { id: string; full_name: string };
type Registration = {
  id: string;
  participant_id: string;
  status: string;
  price_snapshot: number;
  created_at: string;
};
type Payment = {
  id: string;
  registration_id: string;
  amount: number;
  method_code: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export function PaymentsPanel({ supabase, canManage }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [registrationId, setRegistrationId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const [p, r, pay] = await Promise.all([
      supabase.from("participants").select("id,full_name").order("full_name"),
      supabase
        .from("registrations")
        .select("id,participant_id,status,price_snapshot,created_at")
        .in("status", ["PENDING", "CONFIRMED"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("registration_payments")
        .select("id,registration_id,amount,method_code,status,paid_at,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (p.error || r.error || pay.error) {
      setMessage("Não foi possível carregar os pagamentos agora.");
    } else {
      setParticipants((p.data ?? []) as Participant[]);
      setRegistrations((r.data ?? []) as Registration[]);
      setPayments((pay.data ?? []) as Payment[]);
      setMessage(pay.data?.length ? `${pay.data.length} pagamentos mais recentes.` : "Nenhum pagamento registrado ainda.");
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedRegistration = useMemo(
    () => registrations.find((registration) => registration.id === registrationId) ?? null,
    [registrations, registrationId],
  );

  function participantName(participantId: string) {
    return participants.find((participant) => participant.id === participantId)?.full_name ?? "Participante";
  }

  function paymentParticipantName(registrationIdValue: string) {
    const registration = registrations.find((item) => item.id === registrationIdValue);
    return registration ? participantName(registration.participant_id) : "Participante";
  }

  async function createPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRegistration) {
      setMessage("Selecione uma inscrição.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("registration_payments").insert({
      registration_id: selectedRegistration.id,
      amount: Number(selectedRegistration.price_snapshot),
      method_code: "MANUAL",
      status: "PENDING",
    });

    if (error) {
      setMessage("Não foi possível criar o registro de pagamento.");
    } else {
      setRegistrationId("");
      setMessage("Pagamento criado como pendente.");
      await load();
    }
    setBusy(false);
  }

  async function changeStatus(payment: Payment, status: "CONFIRMED" | "CANCELLED") {
    if (!canManage || payment.status !== "PENDING") return;
    setBusy(true);
    const { error } = await supabase
      .from("registration_payments")
      .update({ status })
      .eq("id", payment.id);
    setMessage(
      error
        ? "Não foi possível atualizar o pagamento."
        : status === "CONFIRMED"
          ? "Pagamento confirmado. A inscrição permanece com ciclo próprio."
          : "Pagamento cancelado.",
    );
    await load();
    setBusy(false);
  }

  return (
    <section className="audit-panel" aria-labelledby="payments-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Financeiro</p>
          <h2 id="payments-title">Pagamentos</h2>
        </div>
        <button type="button" className="compact" disabled={busy} onClick={() => void load()}>
          {busy ? "Carregando…" : "Atualizar"}
        </button>
      </div>
      <p className="section-description">
        Registro financeiro da inscrição. Confirmar pagamento não conclui automaticamente a inscrição neste ciclo.
      </p>
      <p role="status" className="status">{message}</p>

      {canManage ? (
        <form onSubmit={createPayment}>
          <label>
            Inscrição
            <select value={registrationId} onChange={(event) => setRegistrationId(event.target.value)} required>
              <option value="">Selecione</option>
              {registrations.map((registration) => (
                <option key={registration.id} value={registration.id}>
                  {participantName(registration.participant_id)} · R$ {Number(registration.price_snapshot).toFixed(2).replace(".", ",")} · {registration.status}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || !selectedRegistration}>Criar pagamento pendente</button>
        </form>
      ) : null}

      {payments.length > 0 ? (
        <div className="audit-list">
          {payments.map((payment) => (
            <article className="audit-item" key={payment.id}>
              <div>
                <strong>{paymentParticipantName(payment.registration_id)}</strong>
                <span>{payment.method_code} · R$ {Number(payment.amount).toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="audit-meta">
                <span>{payment.status}</span>
                {canManage && payment.status === "PENDING" ? (
                  <>
                    <button type="button" className="compact" disabled={busy} onClick={() => void changeStatus(payment, "CONFIRMED")}>Confirmar</button>
                    <button type="button" className="compact secondary" disabled={busy} onClick={() => void changeStatus(payment, "CANCELLED")}>Cancelar</button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
