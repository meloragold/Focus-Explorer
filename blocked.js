const t = document.getElementById("t");
async function tick() {
  const { session } = await chrome.storage.local.get("session");
  if (!session) { t.textContent = "Session over"; return; }
  const s = Math.max(0, Math.round((session.end - Date.now()) / 1000));
  t.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
tick(); setInterval(tick, 1000);
