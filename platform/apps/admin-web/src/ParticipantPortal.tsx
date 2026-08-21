import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { MeuGiroParticipant } from "./MeuGiroParticipant";
import { ParticipantRegistrationCreate } from "./ParticipantRegistrationCreate";
import {
  registrationStatusLabel,
  selectMeuGiroFocus,
  type MeuGiroProgress,
} from "./meu-giro";
import "./participant-portal.css";

type ParticipantModule = "inicio" | "inscricoes" | "meu-giro" | "certificados";

export function ParticipantPortal({
  supabase,
  onSignOut,
}: {
  supabase: SupabaseClient;
  onSignOut: () => Promise<void>;
}) {
  const [activeModule, setActiveModule] = useState<ParticipantModule>("inicio");
  const [registrations, setRegistrations] = useState<MeuGiroProgress[]>([]);
  const [message, setMessage] = useState("Carregando seu Portal Giro…");
  const [showNewRegistration, setShowNewRegistration] = useState(false);
  const focus = useMemo(
    () => selectMeuGiroFocus(registrations),
    [registrations],
  );
  const completed = registrations.filter(
    (registration) => registration.registration_status === "COMPLETED",
  );

  async function loadRegistrations() {
    const { data, error } = await supabase.rpc("my_giro");
    if (error) {
      setMessage("Não foi possível carregar seus dados agora.");
      return;
    }
    setRegistrations((data ?? []) as MeuGiroProgress[]);
    setMessage(
      data?.length ? "Dados atualizados." : "Nenhuma inscrição encontrada.",
    );
  }

  useEffect(() => {
    void loadRegistrations();
  }, [supabase]);

  return (
    <main className="shell dashboard-shell participant-shell">
      <section className="card dashboard participant-portal">
        <header className="participant-header">
          <div>
            <p className="eyebrow">Área do participante</p>
            <h1>Portal Giro</h1>
            <p className="participant-subtitle">
              Inscrições, evolução no desafio e conquistas em um só lugar.
            </p>
          </div>
          <button
            className="secondary compact"
            onClick={() => void onSignOut()}
          >
            Sair
          </button>
        </header>

        <nav className="participant-nav" aria-label="Funções do participante">
          <button
            type="button"
            className={activeModule === "inicio" ? "active" : ""}
            onClick={() => setActiveModule("inicio")}
          >
            Início
          </button>
          <button
            type="button"
            className={activeModule === "inscricoes" ? "active" : ""}
            onClick={() => setActiveModule("inscricoes")}
          >
            Inscrições
          </button>
          <button
            type="button"
            className={activeModule === "meu-giro" ? "active" : ""}
            onClick={() => setActiveModule("meu-giro")}
          >
            Meu Giro
          </button>
          <button
            type="button"
            className={activeModule === "certificados" ? "active" : ""}
            onClick={() => setActiveModule("certificados")}
          >
            Certificados
          </button>
        </nav>

        {activeModule === "inicio" ? (
          <section
            className="participant-module"
            aria-labelledby="participant-home-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Visão geral</p>
                <h2 id="participant-home-title">Seu Giro</h2>
              </div>
            </div>
            <p role="status" className="status">
              {message}
            </p>

            <div className="participant-summary-grid">
              <button
                type="button"
                onClick={() => setActiveModule("inscricoes")}
              >
                <span>Inscrições</span>
                <strong>{registrations.length}</strong>
                <small>Consultar participações</small>
              </button>
              <button type="button" onClick={() => setActiveModule("meu-giro")}>
                <span>Meu Giro</span>
                <strong>{focus ? `${focus.progress_percent}%` : "—"}</strong>
                <small>
                  {focus ? "Progresso da meta atual" : "Sem desafio em foco"}
                </small>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule("certificados")}
              >
                <span>Certificados</span>
                <strong>{completed.length}</strong>
                <small>Conclusões elegíveis</small>
              </button>
            </div>

            {focus ? (
              <article className="participant-focus">
                <div>
                  <p className="eyebrow">Desafio em foco</p>
                  <h3>{focus.challenge_name}</h3>
                  <span className="status-pill">
                    Inscrição{" "}
                    {registrationStatusLabel(focus.registration_status)}
                  </span>
                </div>
                <div>
                  <strong>{focus.completed_km} km</strong>
                  <span>de {focus.target_km} km</span>
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {activeModule === "inscricoes" ? (
          <section
            className="participant-module"
            aria-labelledby="participant-registrations-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Participações</p>
                <h2 id="participant-registrations-title">Minhas inscrições</h2>
              </div>
              <button
                type="button"
                className="compact"
                onClick={() => setShowNewRegistration((current) => !current)}
              >
                {showNewRegistration ? "Fechar" : "Nova inscrição"}
              </button>
            </div>
            <p className="section-description">
              Consulte suas participações ou faça uma nova inscrição nos
              desafios disponíveis.
            </p>

            {showNewRegistration ? (
              <ParticipantRegistrationCreate
                supabase={supabase}
                onCreated={async () => {
                  await loadRegistrations();
                  setShowNewRegistration(false);
                }}
              />
            ) : null}

            <div className="participant-registration-list">
              {registrations.length ? (
                registrations.map((registration) => (
                  <article key={registration.registration_id}>
                    <div>
                      <strong>{registration.challenge_name}</strong>
                      <span>
                        {String(registration.reference_month).padStart(2, "0")}/
                        {registration.reference_year}
                      </span>
                    </div>
                    <div>
                      <span className="status-pill">
                        {registrationStatusLabel(
                          registration.registration_status,
                        )}
                      </span>
                      <small>Meta: {registration.target_km} km</small>
                    </div>
                  </article>
                ))
              ) : (
                <p>Nenhuma inscrição vinculada à sua conta.</p>
              )}
            </div>
          </section>
        ) : null}

        {activeModule === "meu-giro" ? (
          <section className="participant-module participant-meu-giro">
            <MeuGiroParticipant
              supabase={supabase}
              onSignOut={onSignOut}
              embedded
            />
          </section>
        ) : null}

        {activeModule === "certificados" ? (
          <section
            className="participant-module"
            aria-labelledby="participant-certificates-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Conquistas</p>
                <h2 id="participant-certificates-title">Certificados</h2>
              </div>
            </div>
            <p className="section-description">
              Os desafios concluídos aparecem aqui como elegíveis. A geração e o
              download do certificado serão conectados neste módulo.
            </p>
            <div className="participant-registration-list">
              {completed.length ? (
                completed.map((registration) => (
                  <article key={registration.registration_id}>
                    <div>
                      <strong>{registration.challenge_name}</strong>
                      <span>
                        {String(registration.reference_month).padStart(2, "0")}/
                        {registration.reference_year}
                      </span>
                    </div>
                    <span className="status-pill">Conclusão registrada</span>
                  </article>
                ))
              ) : (
                <p>Nenhum desafio concluído elegível para certificado.</p>
              )}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
