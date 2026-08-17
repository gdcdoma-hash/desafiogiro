export type MeuGiroProgress = {
  registration_id: string;
  challenge_id: string;
  challenge_name: string;
  reference_year: number;
  reference_month: number;
  target_km: number;
  completed_km: number;
  remaining_km: number;
  progress_percent: number;
  registration_status: string;
  sports_starts_at: string;
  sports_ends_at: string;
  is_current_focus: boolean;
};

export function selectMeuGiroFocus(items: MeuGiroProgress[]) {
  return items.find((item) => item.is_current_focus) ?? items[0] ?? null;
}

export function registrationStatusLabel(status: string) {
  return (
    {
      PENDING: "Pendente",
      CONFIRMED: "Confirmada",
      COMPLETED: "Concluída",
      CANCELLED: "Cancelada",
      EXPIRED: "Expirada",
    }[status] ?? status
  );
}
