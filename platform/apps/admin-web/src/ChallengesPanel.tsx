import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Challenge = {
  id: string;
  code: string;
  public_name: string;
  reference_year: number;
  reference_month: number | null;
  sports_starts_at: string;
  sports_ends_at: string;
  status:
    "DRAFT" | "SCHEDULED" | "ACTIVE" | "FINISHED" | "CANCELLED" | "ARCHIVED";
  is_public: boolean;
};

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

const statusLabel: Record<Challenge["status"], string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Programado",
  ACTIVE: "Ativo",
  FINISHED: "Encerrado",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};

function toIsoLocal(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function ChallengesPanel({ supabase, canManage }: Props) {
  const now = useMemo(() => new Date(), []);
  const [items, setItems] = useState<Challenge[]>([]);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(now.getMonth() + 1);
  const [referenceYear, setReferenceYear] = useState(now.getFullYear());
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function load() {
    setBusy(true);
    setMessage("Carregando desafios…");
    const { data, error } = await supabase
      .from("challenges")
      .select(
        "id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status,is_public",
      )
      .order("sports_starts_at", { ascending: false });

    if (error) {
      setItems([]);
      setMessage("Não foi possível carregar os desafios.");
    } else {
      setItems((data ?? []) as Challenge[]);
      setMessage(data?.length ? "" : "Nenhum desafio cadastrado ainda.");
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createChallenge(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    if (!startsAt || !endsAt) {
      setMessage("Informe o início e o fim do período esportivo.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setMessage("O fim do desafio precisa ser posterior ao início.");
      return;
    }

    setBusy(true);
    setMessage("Salvando desafio…");
    const normalizedCode = code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const { error } = await supabase.from("challenges").insert({
      code: normalizedCode,
      public_name: name.trim(),
      reference_year: referenceYear,
      reference_month: referenceMonth,
      sports_starts_at: toIsoLocal(startsAt),
      sports_ends_at: toIsoLocal(endsAt),
      timezone: "America/Fortaleza",
      status: "DRAFT",
      is_public: false,
    });

    if (error) {
      setMessage(
        error.code === "23505"
          ? "Já existe um desafio com esse código."
          : "Não foi possível salvar o desafio.",
      );
      setBusy(false);
      return;
    }

    await supabase.rpc("write_audit_event", {
      event_action: "challenge.created",
      event_application_version: "challenges-cycle-1",
      event_metadata: { code: normalizedCode },
      event_outcome: "success",
      event_reason: null,
      event_request_id: crypto.randomUUID(),
      event_resource_type: "challenge",
    });

    setName("");
    setCode("");
    setStartsAt("");
    setEndsAt("");
    setShowForm(false);
    setMessage("Desafio criado em rascunho.");
    await load();
    setBusy(false);
  }

  function formatPeriod(item: Challenge) {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
    });
    return `${formatter.format(new Date(item.sports_starts_at))} a ${formatter.format(new Date(item.sports_ends_at))}`;
  }

  return (
    <section className="module-panel" aria-labelledby="challenges-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operação</p>
          <h2 id="challenges-title">Desafios</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            className="compact"
            onClick={() => setShowForm((value) => !value)}
            disabled={busy}
          >
            {showForm ? "Cancelar" : "Novo desafio"}
          </button>
        ) : null}
      </div>
      <p className="section-description">
        Cadastre primeiro a edição. Metas e ofertas serão configuradas dentro
        dela nas próximas etapas.
      </p>

      {showForm ? (
        <form className="challenge-form" onSubmit={createChallenge}>
          <label>
            Nome público
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Desafio Giro Agosto 2026"
              required
              minLength={2}
            />
          </label>
          <label>
            Código interno
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ex.: agosto-2026"
              required
              pattern="[A-Za-z0-9_-]+"
            />
          </label>
          <div className="form-grid two">
            <label>
              Mês de referência
              <input
                type="number"
                min={1}
                max={12}
                value={referenceMonth}
                onChange={(event) =>
                  setReferenceMonth(Number(event.target.value))
                }
                required
              />
            </label>
            <label>
              Ano de referência
              <input
                type="number"
                min={2020}
                max={2200}
                value={referenceYear}
                onChange={(event) =>
                  setReferenceYear(Number(event.target.value))
                }
                required
              />
            </label>
          </div>
          <div className="form-grid two">
            <label>
              Início do período esportivo
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>
            <label>
              Fim do período esportivo
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Criar rascunho"}
            </button>
          </div>
        </form>
      ) : null}

      <p role="status" className="status">
        {message}
      </p>

      <div className="challenge-list">
        {items.map((item) => (
          <article className="challenge-item" key={item.id}>
            <div className="challenge-main">
              <div className="challenge-title-row">
                <strong>{item.public_name}</strong>
                <span
                  className={`challenge-status ${item.status.toLowerCase()}`}
                >
                  {statusLabel[item.status]}
                </span>
              </div>
              <span className="challenge-code">{item.code}</span>
              <span>{formatPeriod(item)}</span>
            </div>
            <div className="challenge-side">
              <span>
                {item.reference_month
                  ? `${String(item.reference_month).padStart(2, "0")}/${item.reference_year}`
                  : item.reference_year}
              </span>
              <span>{item.is_public ? "Visível" : "Não publicado"}</span>
            </div>
          </article>
        ))}
      </div>
      {items.length ? (
        <button
          type="button"
          className="link-button"
          onClick={() => void load()}
          disabled={busy}
        >
          Atualizar lista
        </button>
      ) : null}
    </section>
  );
}
