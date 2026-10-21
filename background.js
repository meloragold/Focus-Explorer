const DEFAULTS = {
  blocklist: ["youtube.com", "x.com", "twitter.com", "instagram.com", "reddit.com", "facebook.com", "tiktok.com"],
  goalMin: 60, sessionMin: 25,
  day: null, minutesToday: 0,
  streak: 0, bestStreak: 0, lastGoalDay: null,
  expeditionDays: 0, totalMin: 0, session: null
};
const dayKey = (d = new Date()) => d.toLocaleDateString("en-CA");
const yesterdayKey = () => dayKey(new Date(Date.now() - 864e5));

async function getState() {
  const s = { ...DEFAULTS, ...(await chrome.storage.local.get(null)) };
  const t = dayKey();
  if (s.day !== t) {
    s.day = t; s.minutesToday = 0;
    if (s.lastGoalDay && s.lastGoalDay !== yesterdayKey()) s.streak = 0; // missed a day
    await chrome.storage.local.set({ day: s.day, minutesToday: 0, streak: s.streak });
  }
  return s;
}

async function setBlocking(on, list) {
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = on ? list.map((d, i) => ({
    id: i + 1, priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
    condition: { requestDomains: [d], resourceTypes: ["main_frame"] }
  })) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(r => r.id), addRules });
}

async function startSession() {
  const s = await getState();
  if (s.session) return;
  const end = Date.now() + s.sessionMin * 60000;
  await chrome.storage.local.set({ session: { end, min: s.sessionMin } });
  await chrome.alarms.create("focus-end", { when: end });
  await setBlocking(true, s.blocklist);
  chrome.action.setBadgeText({ text: "ON" });
}

async function stopSession(completed) {
  const s = await getState();
  const patch = { session: null };
  if (completed && s.session) {
    patch.minutesToday = s.minutesToday + s.session.min;
    patch.totalMin = s.totalMin + s.session.min;
    if (patch.minutesToday >= s.goalMin && s.lastGoalDay !== s.day) {
      patch.streak = s.streak + 1;
      patch.bestStreak = Math.max(s.bestStreak, patch.streak);
      patch.expeditionDays = s.expeditionDays + 1;
      patch.lastGoalDay = s.day;
    }
  }
  await chrome.storage.local.set(patch);
  await chrome.alarms.clear("focus-end");
  await setBlocking(false, []);
  chrome.action.setBadgeText({ text: "" });
}

async function resume() { // alarms don't survive browser restarts
  const s = await getState();
  if (!s.session) return setBlocking(false, []);
  if (Date.now() >= s.session.end) return stopSession(true);
  chrome.alarms.create("focus-end", { when: s.session.end });
  setBlocking(true, s.blocklist);
  chrome.action.setBadgeText({ text: "ON" });
}

chrome.runtime.onStartup.addListener(resume);
chrome.runtime.onInstalled.addListener(resume);
chrome.alarms.onAlarm.addListener(a => { if (a.name === "focus-end") stopSession(true); });

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  (async () => {
    if (msg.type === "start") await startSession();
    if (msg.type === "stop") await stopSession(false);
    if (msg.type === "save") {
      await chrome.storage.local.set(msg.settings);
      const s = await getState();
      if (s.session) await setBlocking(true, s.blocklist);
    }
    reply(await getState());
  })();
  return true;
});
