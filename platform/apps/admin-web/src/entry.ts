const searchParams = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const area = searchParams.get("area");
const authType = searchParams.get("type") ?? hashParams.get("type");
const participantEntry =
  area === "participante" || area === "meu-giro" || authType === "invite";

if (participantEntry) {
  void import("./participant-main");
} else {
  void import("./main");
}
