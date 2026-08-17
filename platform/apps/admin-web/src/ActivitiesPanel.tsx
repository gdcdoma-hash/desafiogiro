import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Registration = {
  id: string;
  participant_id: string;
  challenge_id: string;
  status: string;
};
type Participant = { id: string; full_name: string };
type Challenge = { id: string; public_name: string; timezone: string };
type Activity = {
  id: string;
  registration_id: string;
  title: string;
  distance_km: number;
  started_local_at: string;
};

export function ActivitiesPanel({
  supabase,
  canManage,
}: {
  supabase: SupabaseClient;
  canManage: boolean;
}) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [registrationId, setRegistrationId] = useState("");
  const [title, setTitle] = useState("Pedal registrado pela equipe");
  const [distance, setDistance] = useState("");
  const [startedLocal, setStartedLocal] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [r, p, c, a] = await Promise.all([
      supabase
        .from("registrations")
        .select("id,participant_id,challenge_id,status")
        .in("status", ["PENDING", "CONFIRMED", "COMPLETED"]),
      supabase.from("participants").select("id,full_name").order("full_name"),
      supabase
        .from("challenges")
        .select("id,public_name,timezone")
        .order("sports_starts_at", { ascending: false }),
      supabase
        .from("participant_activities")
        .select("id,registration_id,title,distance_km,started_local_at")
        .order("started_local_at", { ascending: false })
        .limit(50),
    ]);
    if ([r, p, c, a].some((result) => result.error))
      setMessage("Não foi possível carregar as atividades.");
    else {
      setRegistrations((r.data ?? []) as Registration[]);
      setParticipants((p.data ?? []) as Participant[]);
      setChallenges((c.data ?? []) as Challenge[]);
      setActivities((a.data ?? []) as Activity[]);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const selected = registrations.find((item) => item.id === registrationId);
  const timezone =
    challenges.find((item) => item.id === selected?.challenge_id)?.timezone ??
    "America/Fortaleza";
  const labels = useMemo(
    () =>
      new Map(
        registrations.map((r) => [
          r.id,
          `${participants.find((p) => p.id === r.participant_id)?.full_name ?? "Participante"} — ${challenges.find((c) => c.id === r.challenge_id)?.public_name ?? "Desafio"}`,
        ]),
      ),
    [challenges, participants, registrations],
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("Registrando atividade…");
    const { error } = await supabase.rpc("record_manual_activity", {
      target_registration_id: registrationId,
      activity_title: title,
      activity_distance_km: Number(distance),
      activity_started_local_at: startedLocal,
      activity_timezone: timezone,
      activity_notes: notes,
    });
    if (error)
      setMessage(
        "Não foi possível registrar. Confira período, distância e inscrição.",
      );
    else {
      setMessage("Atividade manual registrada e auditada.");
      setDistance("");
      setStartedLocal("");
      setNotes("");
      await load();
    }
    setBusy(false);
  }

  return (
    <section className="module-panel" aria-labelledby="activities-admin-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Meu Giro</p>
          <h2 id="activities-admin-title">Atividades manuais</h2>
        </div>
      </div>
      <p className="section-description">
        Contingência administrativa. Informe o início no horário local do
        desafio; o registro gera auditoria.
      </p>
      {canManage ? (
        <form className="challenge-form" onSubmit={save}>
          <label>
            Inscrição
            <select
              required
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value)}
            >
              <option value="">Selecione</option>
              {registrations.map((r) => (
                <option key={r.id} value={r.id}>
                  {labels.get(r.id)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid two">
            <label>
              Título
              <input
                required
                minLength={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Distância (km)
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </label>
          </div>
          <div className="form-grid two">
            <label>
              Início local
              <input
                required
                type="datetime-local"
                value={startedLocal}
                onChange={(e) => setStartedLocal(e.target.value)}
              />
            </label>
            <label>
              Fuso horário
              <input value={timezone} readOnly />
            </label>
          </div>
          <label>
            Observação
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button disabled={busy}>
            {busy ? "Registrando…" : "Registrar atividade"}
          </button>
        </form>
      ) : null}
      <p role="status" className="status">
        {message}
      </p>
      <div className="activity-list">
        {activities.map((a) => (
          <article key={a.id}>
            <div>
              <strong>{a.title}</strong>
              <span>{labels.get(a.registration_id)}</span>
            </div>
            <strong>{a.distance_km} km</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
