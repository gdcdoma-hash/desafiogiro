export function ReservationStatusNote({
  reservationStatus,
  avatarAcceptanceReady,
}: {
  reservationStatus: string | null;
  avatarAcceptanceReady: boolean;
}) {
  return (
    <>
      <span>
        {reservationStatus === "RESERVED"
          ? "Medalha reservada"
          : "Sem reserva de medalha"}
      </span>
      {avatarAcceptanceReady ? <span>Avatar de aceite liberado</span> : null}
    </>
  );
}
