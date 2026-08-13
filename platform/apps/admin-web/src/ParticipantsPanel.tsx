import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type Participant = {
  id: string;
  legacy_id_dgmb: string | null;
  full_name: string;
  phone_e164: string | null;
  city: string;
  state_code: string | null;
  status: "ACTIVE" | "INACTIVE" | "MERGED";
};

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `+${withCountry}`;
}

export function ParticipantsPanel({ supabase, canManage }: Props) {
  const [items, setItems] = useState<Participant[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [legacyId, setLegacyId] = useState("");
  const [status, setStatus] = useState<Participant["status"]>("ACTIVE");

  const visibleItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return items;
    return items.filter((item) =>
      [
        item.full_name,
        item.phone_e164 ?? "",
        item.city,
        item.state_code ?? "",
        item.legacy_id_dgmb ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [items, query]);

  function clearForm() {
    setEditingId(null);
    setFullName("");
    setPhone("");
    setCity("");
    setStateCode("");
    setLegacyId("");
    setStatus("ACTIVE");
    setShowForm(false);
  }

  function startCreate() {
    clearForm();
    setShowForm(true);
    setMessage("");
  }

  function startEdit(item: Participant) {
    setEditingId(item.id);
    setFullName(item.full_name);
    setPhone(item.phone_e164 ?? "");
    setCity(item.city);
    setStateCode(item.state_code ?? "");
    setLegacyId(item.legacy_id_dgmb ?? "");
    setStatus(item.status);
    setShowForm(true);
    setMessage(`Editando ${item.full_name}.`);
  }

  async function loadParticipants() {
    setBusy(true);
    setMessage("Carregando participantes…");
    const { data, error } = await supabase
      .from("participants")
      .select("id,legacy_id_dgmb,full_name,phone_e164,city,state_code,status")
      .order("full_name", { ascending: true })
      .limit(500);

    if (error) {
      setItems([]);
      setMessage("Não foi possível carregar os participantes.");
    } else {
      setItems((data ?? []) as Participant[]);
      setMessage(data?.length ? "" : "Nenhum participante cadastrado ainda.");
    }
    setBusy(false);
  }

  useEffect(() => {
    void loadParticipants();
  }, []);

  async function saveParticipant(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage) return;

    const normalizedState = stateCode.trim().toUpperCase();
    if (normalizedState && !/^[A-Z]{2}$/.test(normalizedState)) {
      setMessage("Informe a UF com duas letras, por exemplo MA.");
      return;
    }

    setBusy(true);
    setMessage(
      editingId ? "Atualizando participante…" : "Salvando participante…",
    );

    const payload = {
      full_name: fullName.trim(),
      phone_e164: normalizePhone(phone),
      city: city.trim(),
      state_code: normalizedState || null,
      legacy_id_dgmb: legacyId.trim() || null,
      status,
    };

    const request = editingId
      ? supabase
          .from("participants")
          .update(payload)
          .eq("id", editingId)
          .select("id")
          .single()
      : supabase.from("participants").insert(payload).select("id").single();

    const { data, error } = await request;

    if (error) {
      setMessage(
        error.code === "23505"
          ? "Esse ID legado já está vinculado a outro participante."
          : "Não foi possível salvar o participante.",
      );
      setBusy(false);
      return;
    }

    await supabase.rpc("write_audit_event", {
      event_action: editingId ? "participant.updated" : "participant.created",
      event_application_version: "participants-cycle-2",
      event_metadata: {},
      event_outcome: "success",
      event_reason: null,
      event_request_id: crypto.randomUUID(),
      event_resource_type: "participant",
    });

    const wasEditing = Boolean(editingId);
    clearForm();
    await loadParticipants();
    setMessage(
      wasEditing
        ? "Cadastro do participante atualizado."
        : `Participante cadastrado. ID interno: ${data.id.slice(0, 8)}…`,
    );
  }

  return (
    <section className="module-panel" aria-labelledby="participants-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Pessoas</p>
          <h2 id="participants-title">Participantes</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            className="compact"
            onClick={showForm ? clearForm : startCreate}
            disabled={busy}
          >
            {showForm ? "Cancelar" : "Novo participante"}
          </button>
        ) : null}
      </div>
      <p className="section-description">
        Cadastro-base da pessoa. Inscrições e desafios são vinculados ao ID
        interno, não ao CPF.
      </p>

      {showForm ? (
        <form className="challenge-form" onSubmit={saveParticipant}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cadastro</p>
              <h3>{editingId ? "Editar participante" : "Novo participante"}</h3>
            </div>
          </div>
          <label>
            Nome completo
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              minLength={2}
              required
            />
          </label>
          <div className="form-grid two">
            <label>
              Telefone
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="(98) 99999-9999"
                inputMode="tel"
              />
            </label>
            <label>
              ID legado DGMB
              <input
                value={legacyId}
                onChange={(event) => setLegacyId(event.target.value)}
                placeholder="Opcional"
              />
            </label>
          </div>
          <div className="form-grid two">
            <label>
              Cidade
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
            <label>
              UF
              <input
                value={stateCode}
                onChange={(event) => setStateCode(event.target.value)}
                maxLength={2}
                placeholder="MA"
              />
            </label>
          </div>
          {editingId ? (
            <label>
              Situação
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as Participant["status"])
                }
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="MERGED">Consolidado</option>
              </select>
            </label>
          ) : null}
          <div className="form-actions">
            <button type="submit" disabled={busy}>
              {busy
                ? "Salvando…"
                : editingId
                  ? "Salvar alterações"
                  : "Cadastrar participante"}
            </button>
          </div>
        </form>
      ) : null}

      <p role="status" className="status">
        {message}
      </p>

      <label>
        Buscar participante
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome, telefone, cidade ou ID legado"
        />
      </label>

      <div className="simple-list">
        {visibleItems.map((item) => (
          <div className="offer-row" key={item.id}>
            <div>
              <strong>{item.full_name}</strong>
              <span>
                {[item.city, item.state_code].filter(Boolean).join(" - ") ||
                  "Localidade não informada"}
              </span>
              <span>{item.phone_e164 || "Telefone não informado"}</span>
            </div>
            <div className="offer-side">
              <strong>
                {item.status === "ACTIVE"
                  ? "Ativo"
                  : item.status === "INACTIVE"
                    ? "Inativo"
                    : "Consolidado"}
              </strong>
              <span>ID {item.id.slice(0, 8)}…</span>
              {item.legacy_id_dgmb ? (
                <span>Legado: {item.legacy_id_dgmb}</span>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  className="compact"
                  disabled={busy}
                  onClick={() => startEdit(item)}
                >
                  Editar cadastro
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {items.length > 0 && visibleItems.length === 0 ? (
          <p className="empty-note">Nenhum participante encontrado.</p>
        ) : null}
      </div>
    </section>
  );
}
