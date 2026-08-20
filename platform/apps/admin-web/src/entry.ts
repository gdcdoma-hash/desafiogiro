const area = new URLSearchParams(window.location.search).get("area");
const participantEntry = area === "participante" || area === "meu-giro";

if (participantEntry) {
  void import("./participant-main");
} else {
  void import("./main");
}
