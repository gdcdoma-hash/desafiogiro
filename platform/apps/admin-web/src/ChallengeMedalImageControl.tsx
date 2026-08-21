import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";
import "./challenge-medal-image.css";

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function ChallengeMedalImageControl({
  supabase,
  challengeId,
  challengeName,
  medalImagePath,
  canManage,
  onChanged,
}: {
  supabase: SupabaseClient;
  challengeId: string;
  challengeName: string;
  medalImagePath: string | null;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const imageUrl = medalImagePath
    ? supabase.storage.from("challenge-medals").getPublicUrl(medalImagePath)
        .data.publicUrl
    : null;

  async function upload(file: File | null) {
    if (!file || !canManage) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setMessage("Use uma imagem JPG, PNG ou WEBP de até 5 MB.");
      return;
    }

    setBusy(true);
    setMessage("Enviando foto da medalha…");
    const objectPath = `${challengeId}/medal.${extensionFor(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("challenge-medals")
      .upload(objectPath, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setMessage("Não foi possível enviar a foto da medalha.");
      setBusy(false);
      return;
    }

    const { error } = await supabase.rpc("set_challenge_medal_image_path", {
      target_challenge_id: challengeId,
      target_object_path: objectPath,
    });
    if (error) {
      setMessage("A imagem foi enviada, mas não foi vinculada ao desafio.");
      setBusy(false);
      return;
    }

    if (medalImagePath && medalImagePath !== objectPath) {
      await supabase.storage.from("challenge-medals").remove([medalImagePath]);
    }
    await onChanged();
    setMessage("Foto da medalha atualizada.");
    setBusy(false);
  }

  return (
    <section className="config-card challenge-medal-config">
      <div>
        <h3>Foto da medalha</h3>
        <p className="mini-description">
          Esta imagem será exibida ao participante no carrossel de inscrição.
        </p>
      </div>
      <div className="challenge-medal-preview">
        {imageUrl ? (
          <img src={imageUrl} alt={`Medalha ${challengeName}`} />
        ) : (
          <span>Nenhuma foto cadastrada</span>
        )}
      </div>
      {canManage ? (
        <label className="challenge-medal-upload">
          <strong>{medalImagePath ? "Trocar foto" : "Adicionar foto"}</strong>
          <small>JPG, PNG ou WEBP · até 5 MB</small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => void upload(event.target.files?.[0] ?? null)}
          />
        </label>
      ) : null}
      <p role="status" className="status">
        {message}
      </p>
    </section>
  );
}
