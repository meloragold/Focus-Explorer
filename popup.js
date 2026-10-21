const REGIONS = [
  { name: "Whispering Woods", days: 0, note: "Where every expedition starts." },
  { name: "Crystal Lake", days: 3, note: "Still water, clear head." },
  { name: "Ember Caves", days: 7, note: "A week of focus lights the way." },
  { name: "Cloud Peaks", days: 14, note: "Above the noise." },
  { name: "Starfall Isle", days: 30, note: "Few ever reach it." }
];
const $ = id => document.getElementById(id);
let state = null, tick = null;
const send = m => chrome.runtime.sendMessage(m);
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

function render(s) {
  state = s;
  $("streak").textContent = s.streak;
  $("mins").textContent = s.minutesToday + " min";
  $("goalLabel").textContent = `of ${s.goalMin} min goal today`;
  $("fill").style.width = Math.min(100, s.minutesToday / s.goalMin * 100) + "%";
  const active = !!s.session;
  $("toggle").textContent = active ? "End session (no credit)" : "Start focus session";
  $("toggle").className = active ? "stop" : "";
  $("hint").textContent = active ? "Distracting sites are blocked." : `Blocks ${s.blocklist.length} sites for ${s.sessionMin} minutes.`;
  $("map").innerHTML = "";
  let nextMarked = false;
  REGIONS.forEach(r => {
    const li = document.createElement("li");
    const open = s.expeditionDays >= r.days;
    li.className = open ? "open" : (!nextMarked ? "next" : "locked");
    let sub = r.note;
    if (!open && !nextMarked) { nextMarked = true; sub = `${r.days - s.expeditionDays} more goal day(s) to unlock`; }
    else if (!open) li.className = "locked";
    li.innerHTML = `<strong></strong><div class="muted"></div>`;
    li.children[0].textContent = r.name; li.children[1].textContent = sub;
    $("map").appendChild(li);
  });
  if (document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "INPUT") {
    $("blocklist").value = s.blocklist.join("\n");
    $("sessionMin").value = s.sessionMin; $("goalMin").value = s.goalMin;
  }
  clearInterval(tick);
  const draw = () => {
    if (state.session) {
      const left = state.session.end - Date.now();
      $("clock").textContent = fmt(left);
      if (left <= 0) { clearInterval(tick); setTimeout(async () => render(await send({ type: "state" })), 1200); }
    } else $("clock").textContent = fmt(state.sessionMin * 60000);
  };
  draw(); tick = setInterval(draw, 500);
}

$("toggle").onclick = async () => render(await send({ type: state.session ? "stop" : "start" }));
$("save").onclick = async () => {
  const clean = d => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const blocklist = $("blocklist").value.split("\n").map(clean).filter(Boolean);
  const sessionMin = Math.max(1, +$("sessionMin").value || 25);
  const goalMin = Math.max(1, +$("goalMin").value || 60);
  render(await send({ type: "save", settings: { blocklist, sessionMin, goalMin } }));
  $("save").textContent = "Saved"; setTimeout(() => $("save").textContent = "Save settings", 1200);
};
send({ type: "state" }).then(render);
