import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

type CatalogItem = {
  challenge_id: string;
  challenge_name: string;
  short_description: string;
  reference_year: number;
  reference_month: number;
  offer_id: string;
  offer_name: string;
  price: number | string;
  goal_id: string;
  goal_label: string;
  target_km: number;
  display_order: number;
};

type PaymentConfig = {
  pix_key: string;
  pix_holder: string;
};

type RegistrationResult = {
  registration_id: string;
  payment_id: string;
  amount: number | string;
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  return "jpg";
}

export function ParticipantRegistrationCreate({
  supabase,
  onCreated,
}: {
  supabase: SupabaseClient;
  onCreated: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [offerId, setOfferId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("Carregando desafios disponíveis…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const [catalogResponse, paymentResponse] = await Promise.all([
        supabase.rpc("get_participant_registration_catalog"),
        supabase.rpc("get_participant_payment_config"),
      ]);

      if (catalogResponse.error) {
        setCatalog([]);
        setMessage("Não foi possível carregar os desafios disponíveis agora.");
        return;
      }

      const rows = (catalogResponse.data ?? []) as CatalogItem[];
      setCatalog(rows);
      setOfferId(rows[0]?.offer_id ?? "");
      setGoalId(rows[0]?.goal_id ?? "");

      const paymentRows = (paymentResponse.data ?? []) as PaymentConfig[];
      setPaymentConfig(paymentRows[0] ?? null);

      setMessage(
        rows.length
          ? "Preencha as etapas abaixo para enviar sua inscrição."
          : "Você não possui outra inscrição disponível no momento.",
      );
    }

    void load();
  }, [supabase]);

  const offers = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of catalog) {
      if (!map.has(item.offer_id)) map.set(item.offer_id, item);
    }
    return [...map.values()];
  }, [catalog]);

  const goals = useMemo(
    () => catalog.filter((item) => item.offer_id === offerId),
    [catalog, offerId],
  );

  const selected = catalog.find(
    (item) => item.offer_id === offerId && item.goal_id === goalId,
  );

  async function copyPixKey() {
    if (!paymentConfig?.pix_key) return;
    await navigator.clipboard.writeText(paymentConfig.pix_key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function uploadMedia(
    userId: string,
    registrationId: string,
    kind: "AVATAR" | "PAYMENT_PROOF",
    file: File,
  ) {
    const label = kind === "AVATAR" ? "avatar" : "comprovante";
    const objectPath = `${userId}/${registrationId}/${label}.${extensionFor(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("participant-registration-media")
      .upload(objectPath, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { error: attachError } = await supabase.rpc(
      "attach_participant_registration_media",
      {
        target_registration_id: registrationId,
        target_kind: kind,
        target_object_path: objectPath,
        target_mime_type: file.type || "application/octet-stream",
        target_original_name: file.name,
      },
    );

    if (attachError) throw attachError;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!offerId || !goalId || !selected || !avatarFile || !proofFile) {
      setMessage("Adicione sua foto e o comprovante antes de enviar a inscrição.");
      return;
    }

    setBusy(true);
    setMessage("Enviando sua inscrição…");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw authError ?? new Error("Sessão inválida");
      }

      const { data, error } = await supabase.rpc(
        "create_participant_registration",
        {
          target_offer_id: offerId,
          target_goal_id: goalId,
          target_referral_code: null,
        },
      );

      if (error) {
        setMessage(
          error.message.includes("registration limit")
            ? "Esta inscrição não está mais disponível para sua conta."
            : "Não foi possível iniciar a inscrição agora.",
        );
        return;
      }

      const result = data as RegistrationResult;
      await uploadMedia(
        authData.user.id,
        result.registration_id,
        "AVATAR",
        avatarFile,
      );
      await uploadMedia(
        authData.user.id,
        result.registration_id,
        "PAYMENT_PROOF",
        proofFile,
      );

      const { error: submitError } = await supabase.rpc(
        "submit_participant_registration",
        { target_registration_id: result.registration_id },
      );
      if (submitError) throw submitError;

      setMessage(
        "Inscrição enviada. Seu comprovante está aguardando conferência do pagamento.",
      );
      setAvatarFile(null);
      setProofFile(null);
      await onCreated();
    } catch {
      setMessage(
        "A inscrição foi iniciada, mas não foi possível concluir o envio dos arquivos. Tente novamente ou procure a equipe do Giro.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (catalog.length === 0) {
    return (
      <p role="status" className="status">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="participant-registration-form">
      <div className="registration-step">
        <span className="registration-step-number">1</span>
        <div>
          <strong>Escolha o desafio</strong>
          <small>Mostramos somente inscrições disponíveis para sua conta.</small>
        </div>
      </div>

      <label>
        Desafio
        <select
          value={offerId}
          onChange={(event) => {
            const nextOffer = event.target.value;
            const firstGoal = catalog.find(
              (item) => item.offer_id === nextOffer,
            );
            setOfferId(nextOffer);
            setGoalId(firstGoal?.goal_id ?? "");
          }}
          disabled={busy || offers.length === 0}
        >
          {offers.map((offer) => (
            <option key={offer.offer_id} value={offer.offer_id}>
              {offer.challenge_name} — {offer.offer_name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Meta
        <select
          value={goalId}
          onChange={(event) => setGoalId(event.target.value)}
          disabled={busy || goals.length === 0}
        >
          {goals.map((goal) => (
            <option key={goal.goal_id} value={goal.goal_id}>
              {goal.goal_label}
            </option>
          ))}
        </select>
      </label>

      <div className="registration-step">
        <span className="registration-step-number">2</span>
        <div>
          <strong>Adicione sua foto</strong>
          <small>Escolha uma foto nítida para seu avatar do desafio.</small>
        </div>
      </div>

      <label className="registration-upload">
        <span>{avatarFile ? "Trocar foto" : "Adicionar foto"}</span>
        <small>{avatarFile ? avatarFile.name : "JPG, PNG ou WEBP"}</small>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </label>

      <div className="registration-step">
        <span className="registration-step-number">3</span>
        <div>
          <strong>Faça o pagamento</strong>
          <small>Copie a chave PIX e pague o valor da inscrição.</small>
        </div>
      </div>

      {selected ? (
        <div className="registration-payment-card">
          <span>Valor da inscrição</span>
          <strong>{formatMoney(selected.price)}</strong>
          {paymentConfig ? (
            <>
              <small>{paymentConfig.pix_holder}</small>
              <code>{paymentConfig.pix_key}</code>
              <button
                type="button"
                onClick={() => void copyPixKey()}
                disabled={busy}
              >
                {copied ? "Chave copiada ✓" : "Copiar chave PIX"}
              </button>
            </>
          ) : (
            <p className="status">Chave PIX indisponível no momento.</p>
          )}
        </div>
      ) : null}

      <div className="registration-step">
        <span className="registration-step-number">4</span>
        <div>
          <strong>Envie o comprovante</strong>
          <small>Após o envio, a equipe fará a conferência do pagamento.</small>
        </div>
      </div>

      <label className="registration-upload">
        <span>{proofFile ? "Trocar comprovante" : "Enviar comprovante"}</span>
        <small>{proofFile ? proofFile.name : "Imagem ou PDF, até 10 MB"}</small>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </label>

      <button
        type="submit"
        disabled={
          busy || !selected || !avatarFile || !proofFile || !paymentConfig
        }
      >
        {busy ? "Enviando…" : "Enviar inscrição para conferência"}
      </button>

      <p role="status" className="status">
        {message}
      </p>
    </form>
  );
}
