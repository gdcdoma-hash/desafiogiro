import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type CategoryRule = {
  category_code: string;
  max_items: number;
  reserve_on_add: boolean;
  reservation_minutes: number;
  is_active: boolean;
};

type PixKey = {
  registration_count: number;
  pix_key: string;
  pix_holder: string;
  is_active: boolean;
};

type Config = {
  categories: CategoryRule[];
  pix_keys: PixKey[];
};

function labelCategory(code: string) {
  if (code === "NORMAL") return "Normal";
  if (code === "REPESCAGEM") return "Repescagem";
  if (code === "TESTE_FLUXO") return "Teste do fluxo";
  return code;
}

export function ParticipantRegistrationConfigPanel({
  supabase,
  canManageLimits,
  canManagePix,
}: {
  supabase: SupabaseClient;
  canManageLimits: boolean;
  canManagePix: boolean;
}) {
  const [config, setConfig] = useState<Config>({ categories: [], pix_keys: [] });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const { data, error } = await supabase.rpc(
      "get_participant_registration_admin_config",
    );
    if (error) {
      setMessage("Não foi possível carregar a configuração das inscrições.");
    } else {
      setConfig(data as Config);
      setMessage("Configuração atual carregada.");
    }
    setBusy(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function updateCategory(code: string, patch: Partial<CategoryRule>) {
    setConfig((current) => ({
      ...current,
      categories: current.categories.map((row) =>
        row.category_code === code ? { ...row, ...patch } : row,
      ),
    }));
  }

  function updatePix(count: number, patch: Partial<PixKey>) {
    setConfig((current) => ({
      ...current,
      pix_keys: current.pix_keys.map((row) =>
        row.registration_count === count ? { ...row, ...patch } : row,
      ),
    }));
  }

  async function saveCategory(rule: CategoryRule) {
    if (!canManageLimits) return;
    setBusy(true);
    const { error } = await supabase.rpc(
      "upsert_participant_registration_category_rule",
      {
        target_category_code: rule.category_code,
        target_max_items: Number(rule.max_items),
        target_reserve_on_add: rule.reserve_on_add,
        target_reservation_minutes: Number(rule.reservation_minutes),
        target_is_active: rule.is_active,
      },
    );
    setMessage(
      error
        ? "Não foi possível salvar o limite desta categoria."
        : `Regra de ${labelCategory(rule.category_code)} salva.`,
    );
    setBusy(false);
  }

  async function savePix(row: PixKey) {
    if (!canManagePix) return;
    setBusy(true);
    const { error } = await supabase.rpc("upsert_participant_pix_key", {
      target_registration_count: Number(row.registration_count),
      target_pix_key: row.pix_key,
      target_pix_holder: row.pix_holder,
      target_is_active: row.is_active,
    });
    setMessage(
      error
        ? "Não foi possível salvar a chave PIX desta quantidade."
        : `PIX para ${row.registration_count} inscrição(ões) salvo.`,
    );
    setBusy(false);
  }

  const visibleCategories = config.categories.filter((row) =>
    ["NORMAL", "REPESCAGEM", "TESTE_FLUXO"].includes(row.category_code),
  );

  return (
    <details className="registration-admin-config">
      <summary>Configuração das inscrições do participante</summary>
      <p className="section-description">
        Limites por tipo, reserva temporária de medalhas e chave PIX conforme a
        quantidade de inscrições no mesmo pagamento.
      </p>
      <p role="status" className="status">
        {message}
      </p>

      <div className="registration-config-grid">
        <section>
          <h3>Limites e reserva</h3>
          {visibleCategories.map((rule) => (
            <div className="registration-config-row" key={rule.category_code}>
              <strong>{labelCategory(rule.category_code)}</strong>
              <label>
                Máximo por participante
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rule.max_items}
                  disabled={!canManageLimits || busy}
                  onChange={(event) =>
                    updateCategory(rule.category_code, {
                      max_items: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={rule.reserve_on_add}
                  disabled={!canManageLimits || busy}
                  onChange={(event) =>
                    updateCategory(rule.category_code, {
                      reserve_on_add: event.target.checked,
                    })
                  }
                />
                Reservar medalha ao adicionar
              </label>
              {rule.reserve_on_add ? (
                <label>
                  Reserva temporária (minutos)
                  <input
                    type="number"
                    min={10}
                    max={1440}
                    value={rule.reservation_minutes}
                    disabled={!canManageLimits || busy}
                    onChange={(event) =>
                      updateCategory(rule.category_code, {
                        reservation_minutes: Number(event.target.value),
                      })
                    }
                  />
                </label>
              ) : null}
              {canManageLimits ? (
                <button
                  type="button"
                  className="compact"
                  disabled={busy}
                  onClick={() => void saveCategory(rule)}
                >
                  Salvar regra
                </button>
              ) : null}
            </div>
          ))}
        </section>

        <section>
          <h3>PIX por quantidade</h3>
          {config.pix_keys.map((row) => (
            <div
              className="registration-config-row"
              key={row.registration_count}
            >
              <strong>
                {row.registration_count} {row.registration_count === 1 ? "inscrição" : "inscrições"}
              </strong>
              <label>
                Chave PIX
                <input
                  type="text"
                  value={row.pix_key}
                  disabled={!canManagePix || busy}
                  onChange={(event) =>
                    updatePix(row.registration_count, {
                      pix_key: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Identificação do recebedor
                <input
                  type="text"
                  value={row.pix_holder}
                  disabled={!canManagePix || busy}
                  onChange={(event) =>
                    updatePix(row.registration_count, {
                      pix_holder: event.target.value,
                    })
                  }
                />
              </label>
              {canManagePix ? (
                <button
                  type="button"
                  className="compact"
                  disabled={busy}
                  onClick={() => void savePix(row)}
                >
                  Salvar PIX
                </button>
              ) : null}
            </div>
          ))}
        </section>
      </div>
    </details>
  );
}
