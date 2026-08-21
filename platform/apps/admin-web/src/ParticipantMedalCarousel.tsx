import type { SupabaseClient } from "@supabase/supabase-js";
import "./participant-medal-carousel.css";

export type MedalCarouselOption = {
  offer_id: string;
  challenge_id: string;
  challenge_name: string;
  category_code: string;
  medal_image_path: string | null;
  price: number | string;
};

function categoryLabel(categoryCode: string) {
  if (categoryCode === "NORMAL") return "Normal";
  if (categoryCode === "REPESCAGEM") return "Repescagem";
  if (categoryCode === "TESTE_FLUXO") return "Repescagem de teste";
  return categoryCode.replaceAll("_", " ");
}

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export function ParticipantMedalCarousel({
  supabase,
  options,
  selectedOfferId,
  onSelect,
  disabled,
}: {
  supabase: SupabaseClient;
  options: MedalCarouselOption[];
  selectedOfferId: string;
  onSelect: (offerId: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="medal-carousel" aria-label="Medalhas disponíveis">
      {options.map((option) => {
        const imageUrl = option.medal_image_path
          ? supabase.storage
              .from("challenge-medals")
              .getPublicUrl(option.medal_image_path).data.publicUrl
          : null;
        const selected = selectedOfferId === option.offer_id;
        return (
          <button
            type="button"
            key={option.offer_id}
            className={`medal-card ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onSelect(option.offer_id)}
          >
            <div className="medal-card-image">
              {imageUrl ? (
                <img src={imageUrl} alt={`Medalha ${option.challenge_name}`} />
              ) : (
                <span>Foto da medalha</span>
              )}
            </div>
            <span className="medal-card-category">
              {categoryLabel(option.category_code)}
            </span>
            <strong>{option.challenge_name}</strong>
            <small>A partir de {formatMoney(option.price)}</small>
          </button>
        );
      })}
    </div>
  );
}
