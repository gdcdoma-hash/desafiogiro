import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import {
  registrationStatusLabel,
  selectMeuGiroFocus,
  type MeuGiroProgress,
} from "./meu-giro";
import "./meu-giro.css";

type Activity = {
  id: string;
  title: string;
  distance_km: number;
  started_local_at: string;
  timezone: string;
  source_code: string;
};

export function MeuGiroParticipant({
  supabase,
  onSignOut,
  embedded = false,
}: {
  supabase: SupabaseClient;
  onSignOut: () => Promise<void>;
  embedded?: boolean;
}) {
  const [progress, setProgress] = useState<MeuGiroProgress[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [message, setMessage] = useState("Carregando seu Giro…");
  const focus = useMemo(() => selectMeuGiroFocus(progress), [progress]);

  useEffect(() => {
    void Promise.all([
      supabase.rpc("my_giro"),
      supabase
        .from("participant_activities")
        .select("id,title,distance_km,started_local_at,timezone,source_code")
        .order("started_local_at", { ascending: false })
        .limit(20),
    ]).then(([progressResult, activityResult]) => {
      if (progressResult.error || activityResult.error) {
        setMessage("Não foi possível carregar o Meu Giro agora.");
        return;
      }
      setProgress((progressResult.data ?? []) as MeuGiroProgress[]);
      setActivities((activityResult.data ?? []) as Activity[]);
      setMessage(
        progressResult.data?.length
          ? "Progresso atualizado."
          : "Sua conta ainda não possui uma inscrição ativa.",
      );
    });
  }, [supabase]);

  const content = (
    <section
      className={embedded ? "meu-giro embedded" : "card dashboard meu-giro"}
    >
      <div className="meu-giro-heading">
        <div>
          <p className="eyebrow">Acompanhamento</p>
          <h2>Meu Giro</h2>
        </div>
        {!embedded ? (
          <button
            className="secondary compact"
            onClick={() => void onSignOut()}
          >
            Sair
          </button>
        ) : null}
      </div>
      <p role="status" className="status">
        {message}
      </p>

      {focus ? (
        <>
          <section className="focus-card" aria-labelledby="focus-title">
            <div>
              <p className="eyebrow">Desafio em foco</p>
              <h2 id="focus-title">{focus.challenge_name}</h2>
              <span className="status-pill">
                Inscrição {registrationStatusLabel(focus.registration_status)}
              </span>
            </div>
            <div className="progress-number">
              <strong>{focus.progress_percent}%</strong>
              <span>da meta</span>
            </div>
            <progress max="100" value={focus.progress_percent}>
              {focus.progress_percent}%
            </progress>
            <div className="progress-grid">
              <div>
                <span>Meta</span>
                <strong>{focus.target_km} km</strong>
              </div>
              <div>
                <span>Realizados</span>
                <strong>{focus.completed_km} km</strong>
              </div>
              <div>
                <span>Restantes</span>
                <strong>{focus.remaining_km} km</strong>
              </div>
            </div>
          </section>

          <section className="module-panel" aria-labelledby="activities-title">
            <h2 id="activities-title">Atividades recentes</h2>
            <p className="section-description">
              A competência considera a data e hora local em que o pedal começou.
            </p>
            <div className="activity-list">
              {activities.length ? (
                activities.map((activity) => (
                  <article key={activity.id}>
                    <div>
                      <strong>{activity.title}</strong>
                      <span>
                        {activity.source_code === "MANUAL"
                          ? "Registro manual"
                          : "Strava"}
                      </span>
                    </div>
                    <div>
                      <strong>{activity.distance_km} km</strong>
                      <time>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(`${activity.started_local_at}Z`))}
                      </time>
                    </div>
                  </article>
                ))
              ) : (
                <p>
                  Nenhuma atividade registrada. Sua inscrição e meta continuam
                  visíveis acima.
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );

  if (embedded) return content;

  return <main className="shell dashboard-shell">{content}</main>;
}
