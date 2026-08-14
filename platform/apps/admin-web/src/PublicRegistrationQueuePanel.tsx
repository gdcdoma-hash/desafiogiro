import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Props = {
  supabase: SupabaseClient;
};

type RequestStatus = "RECEIVED" | "PROCESSED" | "REJECTED";

type QueueItem = {
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

export function PublicRegistrationQueuePanel({ supabase }: Props) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "ALL">(
    "RECEIVED",
  );
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [canRead, setCanRead] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  async function load() {
    setMessage("Carregando pré-inscrições…");
    const { data, error } = await supabase
      .from("public_registration_admin_queue")
      .select(
        "id,created_at,status,full_name,phone_e164,city,state_code,referral_code,challenge_name,offer_name,price,goal_label",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setItems([]);
      setMessage("Não foi possível carregar a fila de pré-inscrições.");
      return;
    }

    setItems((data ?? []) as QueueItem[]);
    setMessage(
      data?.length
        ? `${data.length} solicitação(ões) carregada(s).`
        : "Nenhuma pré-inscrição recebida ainda.",
    );
  }

  useEffect(() => {
    let active = true;
    void supabase.rpc("current_admin_context").then(({ data, error }) => {
      if (!active) return;
      const permissions =
        !error && data && typeof data === "object" && "permissions" in data
          ? (data as { permissions?: unknown }).permissions
          : null;
      const values = Array.isArray(permissions)
        ? permissions.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const readAllowed = values.includes("public_registrations.read");
      setCanRead(readAllowed);
      setCanManage(values.includes("public_registrations.manage"));
      setPermissionsLoaded(true);
      if (readAllowed) void load();
    });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(
    () => ({
      RECEIVED: items.filter((item) => item.status === "RECEIVED").length,
      PROCESSED: items.filter((item) => item.status === "PROCESSED").length,
      REJECTED: items.filter((item) => item.status === "REJECTED").length,
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" || item.status === statusFilter;
      const matchesQuery =
        !normalized ||
        [
          item.full_name,
          item.phone_e164,
          item.city,
          item.state_code,
          item.challenge_name,
          item.offer_name,
          item.goal_label,
          item.referral_code ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [items, query, statusFilter]);

  async function processRequest(item: QueueItem) {
    setBusyId(item.id);
    setMessage(`Processando pré-inscrição de ${item.full_name}…`);
    const { error } = await supabase.rpc(
      "process_public_registration_request",
      {
        target_request_id: item.id,
      },
    );

    if (error) {
      setMessage(
        error.message.includes("revisão manual")
          ? "Há conflito de participante para este telefone. Faça revisão manual antes de processar."
          : "Não foi possível processar esta pré-inscrição.",
      );
    } else {
      setMessage(
        "Pré-inscrição processada. Inscrição e pagamento PIX permanecem pendentes até a confirmação financeira.",
      );
      await load();
    }
    setBusyId(null);
  }

  async function rejectRequest(item: QueueItem) {
    setBusyId(item.id);
    setMessage(`Rejeitando solicitação de ${item.full_name}…`);
    const { error } = await supabase.rpc("reject_public_registration_request", {
      target_request_id: item.id,
    });

    setMessage(
      error
        ? "Não foi possível rejeitar esta pré-inscrição."
        : "Pré-inscrição rejeitada.",
    );
    if (!error) await load();
    setBusyId(null);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function formatPrice(value: number) {
    return Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  if (!permissionsLoaded || !canRead) return null;

  return (
    <section
      className="audit-panel"
      aria-labelledby="public-registration-queue-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Entrada pública</p>
          <h2 id="public-registration-queue-title">Pré-inscrições</h2>
        </div>
        <button type="button" className="compact" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <p className="section-description">
        Solicitações enviadas pelo portal. Processar cria participante quando
        necessário, inscrição pendente e pagamento PIX pendente. A medalha só é
        reservada após a confirmação do pagamento.
      </p>

      <p role="status" className="status">
        {message}
      </p>

      <div
        className="registration-summary"
        aria-label="Resumo das pré-inscrições"
      >
        <button
          type="button"
          className={
            statusFilter === "ALL" ? "summary-card selected" : "summary-card"
          }
          onClick={() => setStatusFilter("ALL")}
        >
          <span>Total</span>
          <strong>{items.length}</strong>
        </button>
        {(Object.keys(statusLabels) as RequestStatus[]).map((status) => (
          <button
            type="button"
            key={status}
            className={
              statusFilter === status ? "summary-card selected" : "summary-card"
            }
            onClick={() => setStatusFilter(status)}
          >
            <span>{statusLabels[status]}</span>
            <strong>{summary[status]}</strong>
          </button>
        ))}
      </div>

      <label>
        Buscar pré-inscrição
        <input
          type="search"
          value={query}
          placeholder="Nome, telefone, cidade, desafio ou REF"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {filteredItems.length ? (
        <div className="audit-list">
          {filteredItems.map((item) => (
            <article className="audit-item" key={item.id}>
              <div>
                <strong>{item.full_name}</strong>
                <span>
                  {item.city} - {item.state_code} · {item.phone_e164}
                </span>
                <span>
                  {item.challenge_name} · {item.offer_name} · {item.goal_label}{" "}
                  · {formatPrice(item.price)}
                </span>
                <span>
                  {item.referral_code ? `REF ${item.referral_code} · ` : ""}
                  {formatDate(item.created_at)}
                </span>
              </div>
              <div className="audit-meta">
                <span>{statusLabels[item.status]}</span>
                {canManage && item.status === "RECEIVED" ? (
                  <div className="registration-actions">
                    <button
                      type="button"
                      className="compact"
                      disabled={busyId !== null}
                      onClick={() => void processRequest(item)}
                    >
                      {busyId === item.id ? "Processando…" : "Processar"}
                    </button>
                    <button
                      type="button"
                      className="compact secondary"
                      disabled={busyId !== null}
                      onClick={() => void rejectRequest(item)}
                    >
                      Rejeitar
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-note">
          Nenhuma pré-inscrição corresponde aos filtros atuais.
        </p>
      )}
    </section>
  );
}
