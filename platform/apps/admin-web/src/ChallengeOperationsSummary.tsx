import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import "./operations-summary.css";

type Props = { supabase: SupabaseClient };

type ChallengeOperationRow = {
  challenge_id: string;
  challenge_name: string;
  challenge_status: string;
  is_public: boolean;
  goals_total: number;
  active_goals: number;
  offers_total: number;
  open_offers: number;
  registrations_total: number;
  pending_registrations: number;
  confirmed_registrations: number;
  completed_registrations: number;
  cancelled_registrations: number;
  expired_registrations: number;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Rascunho",
    SCHEDULED: "Programado",
    ACTIVE: "Ativo",
    FINISHED: "Encerrado",
    CANCELLED: "Cancelado",
    ARCHIVED: "Arquivado",
  };
  return labels[status] ?? status;
}

export function ChallengeOperationsSummary({ supabase }: Props) {
  const [rows, setRows] = useState<ChallengeOperationRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setBusy(true);
    const { data, error } = await supabase
      .from("challenge_operations_overview")
      .select(
        "challenge_id,challenge_name,challenge_status,is_public,goals_total,active_goals,offers_total,open_offers,registrations_total,pending_registrations,confirmed_registrations,completed_registrations,cancelled_registrations,expired_registrations",
      )
      .order("challenge_name", { ascending: true });

    if (error) {
      setRows([]);
      setMessage("Não foi possível carregar o resumo operacional dos desafios.");
    } else {
      setRows((data ?? []) as ChallengeOperationRow[]);
      setMessage(
        data?.length
          ? `${data.length} desafio(s) consolidado(s).`
          : "Nenhum desafio disponível para consolidar.",
      );
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="audit-panel" aria-labelledby="challenge-operations-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Resumo</p>
          <h2 id="challenge-operations-title">Operação dos desafios</h2>
        </div>
        <button
          type="button"
          className="compact"
          onClick={() => void load()}
          disabled={busy}
        >
          {busy ? "Carregando…" : "Atualizar"}
        </button>
      </div>
      <p className="section-description">
        Visão somente leitura das metas, ofertas e inscrições de cada edição.
      </p>
      <p role="status" className="status">
        {message}
      </p>

      {rows.length ? (
        <div className="audit-list">
          {rows.map((row) => (
            <article className="audit-item" key={row.challenge_id}>
              <div>
                <strong>{row.challenge_name}</strong>
                <span>
                  {statusLabel(row.challenge_status)} ·{" "}
                  {row.is_public ? "Público" : "Não publicado"}
                </span>
              </div>
              <div className="audit-meta">
                <span>
                  Metas {row.active_goals}/{row.goals_total}
                </span>
                <span>
                  Ofertas abertas {row.open_offers}/{row.offers_total}
                </span>
                <span>Inscrições {row.registrations_total}</span>
                <span>
                  Pendentes {row.pending_registrations} · Confirmadas{" "}
                  {row.confirmed_registrations} · Concluídas{" "}
                  {row.completed_registrations}
                </span>
                {row.cancelled_registrations || row.expired_registrations ? (
                  <span>
                    Canceladas {row.cancelled_registrations} · Expiradas{" "}
                    {row.expired_registrations}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
