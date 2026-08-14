import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import "./public-registrations.css";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

type RequestStatus = "RECEIVED" | "PROCESSED" | "REJECTED";

type RegistrationRequest = {
  id: string;
  created_at: string;
  status: RequestStatus;
  full_name: string;
  phone_e164: string;
  city: string;
  state_code: string;
  referral_code: string | null;
  challenge_name: string;
  offer_name: string;
  price: number;
  goal_label: string;
};

const statusLabels: Record<RequestStatus, string> = {
  RECEIVED: "Recebida",
  PROCESSED: "Processada",
  REJECTED: "Rejeitada",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function PublicRegistrationsPanel({ supabase, canManage }: Props) {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "ALL">(
    "RECEIVED",
  );
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("public_registration_admin_queue")
      .select(
        "id,created_at,status,full_name,phone_e164,city,state_code,referral_code,challenge_name,offer_name,price,goal_label",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setRequests([]);
      setMessage("Não foi possível carregar as pré-inscrições agora.");
    } else {
      setRequests((data ?? []) as RegistrationRequest[]);
      setMessage(
        data?.length
          ? `${data.length} solicitações mais recentes.`
          : "Nenhuma pré-inscrição recebida ainda.",
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const initial: Record<RequestStatus, number> = {
      RECEIVED: 0,
      PROCESSED: 0,
      REJECTED: 0,
    };
    return requests.reduce((accumulator, request) => {
      accumulator[request.status] += 1;
      return accumulator;
    }, initial);
  }, [requests]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "ALL" || request.status === statusFilter;
      const matchesQuery =
        !normalized ||
        [
          request.full_name,
          request.phone_e164,
          request.city,
          request.state_code,
          request.challenge_name,
          request.offer_name,
          request.goal_label,
          request.referral_code ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [query, requests, statusFilter]);

  async function processRequest(id: string) {
    setBusyId(id);
    setMessage("Processando pré-inscrição…");
    const { error } = await supabase.rpc("process_public_registration_request", {
      target_request_id: id,
    });

    if (error) {
      setMessage(
        error.message.includes("Oferta não está mais disponível")
          ? "A oferta desta solicitação não está mais disponível. Revise antes de continuar."
          : "Não foi possível processar esta pré-inscrição.",
      );
    } else {
      setMessage(
        "Pré-inscrição processada: participante, inscrição e pagamento pendente foram vinculados.",
      );
      await load();
    }
    setBusyId(null);
  }

  async function rejectRequest(id: string) {
    setBusyId(id);
    setMessage("Rejeitando pré-inscrição…");
    const { error } = await supabase.rpc("reject_public_registration_request", {
      target_request_id: id,
    });

    if (error) {
      setMessage("Não foi possível rejeitar esta pré-inscrição.");
    } else {
      setMessage("Pré-inscrição rejeitada.");
      await load();
    }
    setBusyId(null);
  }

  return (
    <section
      className="public-registration-panel"
      aria-labelledby="public-registrations-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Entrada pública</p>
          <h2 id="public-registrations-title">Pré-inscrições</h2>
        </div>
        <button
          type="button"
          className="compact"
          disabled={loading || busyId !== null}
          onClick={() => void load()}
        >
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      <p className="section-description">
        Solicitações enviadas pelo formulário público. Processar cria ou vincula
        o participante e gera inscrição e pagamento pendentes; não confirma
        pagamento nem reserva medalha automaticamente.
      </p>

      <div className="public-registration-summary" aria-label="Resumo da fila">
        <button type="button" onClick={() => setStatusFilter("RECEIVED")}>
          <strong>{summary.RECEIVED}</strong>
          <span>Recebidas</span>
        </button>
        <button type="button" onClick={() => setStatusFilter("PROCESSED")}>
          <strong>{summary.PROCESSED}</strong>
          <span>Processadas</span>
        </button>
        <button type="button" onClick={() => setStatusFilter("REJECTED")}>
          <strong>{summary.REJECTED}</strong>
          <span>Rejeitadas</span>
        </button>
      </div>

      <div className="public-registration-filters">
        <label>
          Buscar
          <input
            type="search"
            value={query}
            placeholder="Nome, telefone, cidade, desafio ou REF"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Situação
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as RequestStatus | "ALL")
            }
          >
            <option value="ALL">Todas</option>
            <option value="RECEIVED">Recebidas</option>
            <option value="PROCESSED">Processadas</option>
            <option value="REJECTED">Rejeitadas</option>
          </select>
        </label>
      </div>

      <p role="status" className="status">
        {message}
      </p>

      <div className="public-registration-list">
        {filtered.map((request) => (
          <article className="public-registration-item" key={request.id}>
            <div className="public-registration-main">
              <div>
                <strong>{request.full_name}</strong>
                <span>
                  {request.phone_e164} · {request.city}/{request.state_code}
                </span>
              </div>
              <span className={`request-status ${request.status.toLowerCase()}`}>
                {statusLabels[request.status]}
              </span>
            </div>

            <dl className="public-registration-details">
              <div>
                <dt>Desafio</dt>
                <dd>{request.challenge_name}</dd>
              </div>
              <div>
                <dt>Oferta</dt>
                <dd>{request.offer_name}</dd>
              </div>
              <div>
                <dt>Meta</dt>
                <dd>{request.goal_label}</dd>
              </div>
              <div>
                <dt>Valor</dt>
                <dd>{formatMoney(request.price)}</dd>
              </div>
              <div>
                <dt>REF</dt>
                <dd>{request.referral_code || "—"}</dd>
              </div>
              <div>
                <dt>Recebida</dt>
                <dd>{formatDate(request.created_at)}</dd>
              </div>
            </dl>

            {request.status === "RECEIVED" && canManage ? (
              <div className="public-registration-actions">
                <button
                  type="button"
                  className="compact"
                  disabled={busyId !== null}
                  onClick={() => void processRequest(request.id)}
                >
                  {busyId === request.id ? "Processando…" : "Processar"}
                </button>
                <button
                  type="button"
                  className="secondary compact"
                  disabled={busyId !== null}
                  onClick={() => void rejectRequest(request.id)}
                >
                  Rejeitar
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {!loading && filtered.length === 0 ? (
        <p className="empty-state">Nenhuma solicitação corresponde ao filtro.</p>
      ) : null}
    </section>
  );
}
