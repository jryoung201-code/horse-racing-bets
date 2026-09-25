const STARTING_CASH = 100;
const MIN_BET = 5;
const BETTING_SECONDS = 30;
const HORSES = [
  { id: 0, name: "Thunderbolt", color: "#e8c547", emoji: "\u26A1" },
  { id: 1, name: "Midnight Dash", color: "#3d4f7c", emoji: "\uD83C\uDF19" },
  { id: 2, name: "Lucky Star", color: "#3cb371", emoji: "\u2B50" },
  { id: 3, name: "Dust Devil", color: "#c44536", emoji: "\uD83C\uDF2A\uFE0F" },
  { id: 4, name: "Golden Hoof", color: "#d4a017", emoji: "\uD83C\uDFC6" },
  { id: 5, name: "Storm Chaser", color: "#2e86ab", emoji: "\uD83D\uDCA8" },
];
const $ = (id) => document.getElementById(id);
const els = {
  gate: $("gate"), table: $("table"), topMeta: $("topMeta"),
  roomPill: $("roomPill"), cashPill: $("cashPill"), nameInput: $("nameInput"),
  localBtn: $("localBtn"), gateError: $("gateError"), track: $("track"),
  oddsBoard: $("oddsBoard"), players: $("players"), hostActions: $("hostActions"),
  phaseLabel: $("phaseLabel"), bannerMsg: $("bannerMsg"), timer: $("timer"),
  betBar: $("betBar"), betAmt: $("betAmt"), clearBetBtn: $("clearBetBtn"),
  startRaceBtn: $("startRaceBtn"), startRaceBtn2: $("startRaceBtn2"),
};
let meId = "p1", state = null, selectedHorse = 0, localRoom = null, tick = null;
function generateField() {
  return HORSES.map((h) => {
    const form = 0.55 + Math.random() * 0.9;
    const rawOdds = 1.6 + (1.4 / form) * (0.8 + Math.random() * 1.4);
    const odds = Math.round(rawOdds * 2) / 2;
    return { ...h, form, odds: Math.min(18, Math.max(1.5, odds)) };
  });
}
function simulateRace(horses) {
  const weights = horses.map((h) => 1 / h.odds);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total, winner = horses[0].id;
  for (let i = 0; i < horses.length; i++) { r -= weights[i]; if (r <= 0) { winner = horses[i].id; break; } }
  const finishes = horses.map((h) => {
    const isWin = h.id === winner;
    const base = isWin ? 6.2 : 6.6 + Math.random() * 2.4;
    const jitter = (1 / h.form) * (0.2 + Math.random() * 0.8);
    return { id: h.id, time: +(base + jitter).toFixed(2) };
  });
  finishes.sort((a, b) => a.time - b.time);
  if (finishes[0].id !== winner) {
    const w = finishes.find((f) => f.id === winner);
    const first = finishes[0];
    const tmp = w.time; w.time = first.time - 0.12; first.time = tmp;
    finishes.sort((a, b) => a.time - b.time);
  }
  return { winner, finishes, duration: Math.max(...finishes.map((f) => f.time)) };
}
function onStartRace() {
  if (!localRoom) return;
  if (localRoom.phase === "lobby" || localRoom.phase === "results") localAction("openBetting");
  else if (localRoom.phase === "betting") localAction("startRaceNow");
}
function renderTrack(s, animate) {
  els.track.innerHTML = "";
  s.horses.forEach((h, idx) => {
    const lane = document.createElement("div"); lane.className = "lane";
    const horse = document.createElement("div"); horse.className = "horse";
    horse.innerHTML = `<div class="silks" style="background:${h.color}">${h.emoji}</div><div class="label">${idx + 1}. ${h.name}</div>`;
    lane.appendChild(horse); els.track.appendChild(lane);
    if (animate && s.race) {
      const fin = s.race.finishes.find((f) => f.id === h.id);
      horse.style.transition = `transform ${fin.time}s cubic-bezier(.15,.7,.3,1)`;
      requestAnimationFrame(() => { horse.style.transform = "translateX(92%)"; });
    }
  });
}
function render(s) {
  state = s;
  const player = s.players.find((p) => p.id === meId);
  els.roomPill.textContent = "LIVE TABLE";
  els.cashPill.textContent = player ? "$" + player.money : "$0";
  els.phaseLabel.textContent = s.phase.toUpperCase();
  els.bannerMsg.textContent = s.message || "";
  if (s.phase === "betting" && s.bettingEndsAt) {
    els.timer.textContent = Math.max(0, Math.ceil((s.bettingEndsAt - Date.now()) / 1000)) + "s";
  } else els.timer.textContent = "";
  const racing = s.phase === "racing";
  els.startRaceBtn.disabled = racing;
  els.startRaceBtn.textContent = s.phase === "betting" ? "Start race" : s.phase === "results" ? "Start next race" : "Start race";
  els.oddsBoard.innerHTML = "";
  s.horses.forEach((h) => {
    const row = document.createElement("button");
    row.className = "odd-row" + (selectedHorse === h.id ? " selected" : "");
    row.innerHTML = `<div class="dot" style="background:${h.color}">${h.emoji}</div><div>${h.name}</div><div class="price">${h.odds}:1</div><div class="muted">${s.players.filter((p) => p.betHorse === h.id).length} bets</div>`;
    row.onclick = () => { selectedHorse = h.id; if (s.phase === "betting") placeBet(); render(state); };
    els.oddsBoard.appendChild(row);
  });
  els.players.innerHTML = "";
  [...s.players].sort((a, b) => b.money - a.money).forEach((p) => {
    const li = document.createElement("li");
    const bet = p.betAmount ? `bet $${p.betAmount}` : p.lastPayout ? `won $${p.lastPayout}` : "no bet";
    li.innerHTML = `<span class="${p.id === meId ? "you" : ""}">${p.name}${p.id === meId ? " (betting)" : ""}</span><span>$${p.money} \u00b7 ${bet}</span>`;
    li.onclick = () => { meId = p.id; render(localRoom); };
    els.players.appendChild(li);
  });
  els.hostActions.innerHTML = "";
  const add = document.createElement("button"); add.className = "btn ghost";
  add.textContent = "Add player"; add.onclick = addLocalPlayer; els.hostActions.appendChild(add);
  els.betBar.hidden = s.phase !== "betting";
  renderTrack(s, s.phase === "racing");
}
function placeBet() {
  localAction("bet", { horseId: selectedHorse, amount: Number(els.betAmt.value) });
}
els.clearBetBtn.onclick = () => localAction("clearBet");
els.startRaceBtn.onclick = onStartRace;
els.startRaceBtn2.onclick = onStartRace;
els.localBtn.onclick = startLocal;
els.nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") startLocal(); });
function startLocal() {
  const name = els.nameInput.value.trim() || "Player 1";
  meId = "p1";
  localRoom = { phase: "lobby", horses: generateField(), players: [{ id: "p1", name, money: STARTING_CASH, betHorse: null, betAmount: 0, lastPayout: 0 }], race: null, bettingEndsAt: null, message: "Add players, then hit Start race." };
  els.gate.hidden = true; els.table.hidden = false; els.topMeta.hidden = false;
  render(localRoom);
}
function addLocalPlayer() {
  const n = prompt("Name for the next jockey?"); if (!n) return;
  localRoom.players.push({ id: "p" + (localRoom.players.length + 1), name: n.trim().slice(0, 16), money: STARTING_CASH, betHorse: null, betAmount: 0, lastPayout: 0 });
  localRoom.message = n.trim() + " saddled up."; render(localRoom);
}
function localAction(name, payload) {
  const room = localRoom;
  if (name === "openBetting") {
    room.phase = "betting"; room.horses = generateField(); room.race = null;
    room.message = "Place your bets, then hit Start race!";
    room.players.forEach((p) => { p.betHorse = null; p.betAmount = 0; p.lastPayout = 0; });
    room.bettingEndsAt = Date.now() + BETTING_SECONDS * 1000; render(room);
    clearInterval(tick);
    tick = setInterval(() => {
      if (!localRoom || localRoom.phase !== "betting") return;
      els.timer.textContent = Math.max(0, Math.ceil((localRoom.bettingEndsAt - Date.now()) / 1000)) + "s";
      if (Date.now() >= localRoom.bettingEndsAt) { clearInterval(tick); localAction("startRaceNow"); }
    }, 250);
    return;
  }
  if (name === "bet") {
    if (room.phase !== "betting") return;
    const player = room.players.find((p) => p.id === meId);
    const amt = Math.floor(Number(payload.amount));
    if (!Number.isFinite(amt) || amt < MIN_BET || amt > player.money + (player.betAmount || 0)) return;
    if (player.betAmount) player.money += player.betAmount;
    player.money -= amt; player.betHorse = Number(payload.horseId); player.betAmount = amt; render(room); return;
  }
  if (name === "clearBet") {
    const player = room.players.find((p) => p.id === meId);
    if (!player || !player.betAmount) return;
    player.money += player.betAmount; player.betHorse = null; player.betAmount = 0; render(room); return;
  }
  if (name === "startRaceNow") {
    if (room.phase !== "betting") return;
    clearInterval(tick); room.phase = "racing"; room.bettingEndsAt = null;
    room.race = simulateRace(room.horses); room.message = "They're off!"; render(room);
    setTimeout(() => {
      const winner = room.horses.find((h) => h.id === room.race.winner);
      room.players.forEach((p) => {
        p.lastPayout = 0;
        if (p.betHorse === winner.id && p.betAmount > 0) { p.lastPayout = Math.round(p.betAmount * winner.odds); p.money += p.lastPayout; }
        p.betHorse = null; p.betAmount = 0;
      });
      room.phase = "results"; room.message = winner.emoji + " " + winner.name + " wins at " + winner.odds + ":1!"; render(room);
    }, Math.ceil(room.race.duration * 1000) + 900);
  }
}
