import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { ParticipantCheckoutAdminPanel } from "./ParticipantCheckoutAdminPanel";
import { ParticipantRegistrationConfigPanel } from "./ParticipantRegistrationConfigPanel";
import "./payments-summary.css";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
  canManageRegistrations: boolean;
};

type Participant = { id: string; full_name: string };
type Registration = {
  id: string;
  participant_id: string;
  status: string;
  price_snapshot: number;
  created_at: string;
  checkout_id: string | null;
};
type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
type Payment = {
  id: string;
  registration_id: string;
  amount: number;
  method_code: string;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
};

const paymentLabels: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
};

const registrationLabels: Record<string, string> = {
  PENDING: "Inscrição pendente",
  CONFIRMED: "Inscrição confirmada",
  COMPLETED: "Inscrição concluída",
  CANCELLED: "Inscrição cancelada",
  EXPIRED: "Inscrição expirada",
};

export function PaymentsPanel({
  supabase,
  canManage,
  canManageRegistrations,
}: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [registrationId, setRegistrationId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatus>(
    "ALL",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const [p, r, pay] = await Promise.all([
      supabase.from("participants").select("id,full_name").order("full_name"),
      supabase
        .from("registrations")
        .select(
          "id,participant_id,status,price_snapshot,created_at,checkout_id",
        )
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("registration_payments")
        .select(
          "id,registration_id,amount,method_code,status,paid_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(150),
    ]);

    if (p.error || r.error || pay.error) {
      setMessage("Não foi possível carregar os pagamentos agora.");
    } else {
      setParticipants((p.data ?? []) as Participant[]);
      setRegistrations((r.data ?? []) as Registration[]);
      setPayments((pay.data ?? []) as Payment[]);
      setMessage(
        pay.data?.length
          ? `${pay.data.length} pagamentos mais recentes.`
          : "Nenhum pagamento registrado ainda.",
      );
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const eligibleRegistrations = useMemo(
    () =>
      registrations.filter(
        (registration) =>
          !registration.checkout_id &&
          ["PENDING", "CONFIRMED"].includes(registration.status),
      ),
    [registrations],
  );

  const selectedRegistration = useMemo(
    () =>
      eligibleRegistrations.find(
        (registration) => registration.id === registrationId,
      ) ?? null,
    [eligibleRegistrations, registrationId],
  );

  const counts = useMemo(
    () => ({
      all: payments.length,
      pending: payments.filter((payment) => payment.status === "PENDING")
        .length,
      confirmed: payments.filter((payment) => payment.status === "CONFIRMED")
        .length,
      cancelled: payments.filter((payment) => payment.status === "CANCELLED")
        .length,
    }),
    [payments],
  );

  const confirmedTotal = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "CONFIRMED")
        .reduce((total, payment) => total + Number(payment.amount), 0),
    [payments],
  );

  function participantName(participantId: string) {
    return (
      participants.find((participant) => participant.id === participantId)
        ?.full_name ?? "Participante"
    );
  }

  function registrationForPayment(registrationIdValue: string) {
    return (
      registrations.find((item) => item.id === registrationIdValue) ?? null
    );
  }

  function paymentParticipantName(registrationIdValue: string) {
    const registration = registrationForPayment(registrationIdValue);
    return registration
      ? participantName(registration.participant_id)
      : "Participante não encontrado";
  }

  const filteredPayments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return payments.filter((payment) => {
      if (statusFilter !== "ALL" && payment.status !== statusFilter) {
        return false;
      }
      if (!normalized) return true;
      const registration = registrationForPayment(payment.registration_id);
      const participant = registration
        ? participantName(registration.participant_id)
        : "";
      return [participant, payment.method_code, paymentLabels[payment.status]]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalized);
    });
  }, [payments, query, statusFilter, participants, registrations]);

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

  async function changeStatus(
    payment: Payment,
    status: "CONFIRMED" | "CANCELLED",
  ) {
    if (!canManage || payment.status !== "PENDING") return;
    const registration = registrationForPayment(payment.registration_id);
    if (registration?.checkout_id) {
      setMessage(
        "Este pagamento pertence a um conjunto. Use a área Inscrições agrupadas acima.",
      );
      return;
    }
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

  function formatMoney(value: number) {
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

  return (
    <section className="audit-panel" aria-labelledby="payments-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Financeiro</p>
          <h2 id="payments-title">Pagamentos</h2>
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
        Registro financeiro das inscrições. Pagamentos agrupados do Portal Giro
        são confirmados como um único conjunto.
      </p>

      <ParticipantRegistrationConfigPanel
        supabase={supabase}
        canManageLimits={canManageRegistrations}
        canManagePix={canManage}
      />

      <ParticipantCheckoutAdminPanel
        supabase={supabase}
        canManage={canManage}
      />

      <div className="payments-summary" aria-label="Resumo dos pagamentos">
        <button
          type="button"
          className={statusFilter === "ALL" ? "active" : ""}
          onClick={() => setStatusFilter("ALL")}
        >
          <span>Total</span>
          <strong>{counts.all}</strong>
        </button>
        <button
          type="button"
          className={statusFilter === "PENDING" ? "active" : ""}
          onClick={() => setStatusFilter("PENDING")}
        >
          <span>Pendentes</span>
          <strong>{counts.pending}</strong>
        </button>
        <button
          type="button"
          className={statusFilter === "CONFIRMED" ? "active" : ""}
          onClick={() => setStatusFilter("CONFIRMED")}
        >
          <span>Confirmados</span>
          <strong>{counts.confirmed}</strong>
        </button>
        <button
          type="button"
          className={statusFilter === "CANCELLED" ? "active" : ""}
          onClick={() => setStatusFilter("CANCELLED")}
        >
          <span>Cancelados</span>
          <strong>{counts.cancelled}</strong>
        </button>
        <div className="payments-total">
          <span>Valor confirmado</span>
          <strong>{formatMoney(confirmedTotal)}</strong>
        </div>
      </div>

      <p role="status" className="status">
        {message}
      </p>

      {canManage ? (
        <form className="payment-create-form" onSubmit={createPayment}>
          <label>
            Inscrição aberta sem checkout
            <select
              value={registrationId}
              onChange={(event) => setRegistrationId(event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {eligibleRegistrations.map((registration) => (
                <option key={registration.id} value={registration.id}>
                  {participantName(registration.participant_id)} ·{" "}
                  {formatMoney(registration.price_snapshot)} ·{" "}
                  {registrationLabels[registration.status] ??
                    registration.status}
                </option>
              ))}
            </select>
          </label>
          {selectedRegistration ? (
            <div className="payment-preview">
              <span>Valor da inscrição</span>
              <strong>
                {formatMoney(selectedRegistration.price_snapshot)}
              </strong>
            </div>
          ) : null}
          <button type="submit" disabled={busy || !selectedRegistration}>
            Criar pagamento pendente
          </button>
        </form>
      ) : null}

      <div className="payments-toolbar">
        <label>
          Buscar pagamento
          <input
            type="search"
            value={query}
            placeholder="Participante, método ou situação"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p>{filteredPayments.length} resultado(s)</p>
      </div>

      {filteredPayments.length > 0 ? (
        <div className="audit-list">
          {filteredPayments.map((payment) => {
            const registration = registrationForPayment(
              payment.registration_id,
            );
            return (
              <article className="audit-item payment-item" key={payment.id}>
                <div className="payment-main">
                  <strong>
                    {paymentParticipantName(payment.registration_id)}
                  </strong>
                  <span>
                    {payment.method_code} · {formatMoney(payment.amount)}
                  </span>
                  <span>
                    {registration
                      ? (registrationLabels[registration.status] ??
                        registration.status)
                      : "Inscrição não localizada na consulta atual"}
                  </span>
                  {registration?.checkout_id ? (
                    <span>Parte de um pagamento agrupado</span>
                  ) : null}
                  <time dateTime={payment.created_at}>
                    Registrado em {formatDate(payment.created_at)}
                  </time>
                </div>
                <div className="audit-meta payment-meta">
                  <span
                    className={`payment-status ${payment.status.toLocaleLowerCase()}`}
                  >
                    {paymentLabels[payment.status]}
                  </span>
                  {payment.paid_at ? (
                    <time dateTime={payment.paid_at}>
                      Confirmado em {formatDate(payment.paid_at)}
                    </time>
                  ) : null}
                  {registration?.checkout_id && payment.status === "PENDING" ? (
                    <small>Gerencie pelo conjunto acima.</small>
                  ) : canManage && payment.status === "PENDING" ? (
                    <div className="payment-actions">
                      <button
                        type="button"
                        className="compact"
                        disabled={busy}
                        onClick={() => void changeStatus(payment, "CONFIRMED")}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="compact secondary"
                        disabled={busy}
                        onClick={() => void changeStatus(payment, "CANCELLED")}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-note">
          Nenhum pagamento corresponde aos filtros atuais.
        </p>
      )}
    </section>
  );
}
