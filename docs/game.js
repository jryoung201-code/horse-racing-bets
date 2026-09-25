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

function emptyBets() { return {}; }
function betTotal(p) {
  return Object.values(p.bets || {}).reduce((a, n) => a + n, 0);
}
function betList(p, horses) {
  return Object.entries(p.bets || {})
    .filter(([, amt]) => amt > 0)
    .map(([id, amt]) => {
      const h = horses.find((x) => x.id === Number(id));
      return "$" + amt + " " + (h ? h.name : "?");
    });
}
function newPlayer(id, name) {
  return { id, name, money: STARTING_CASH, bets: emptyBets(), lastPayout: 0 };
}

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
  els.startRaceBtn.disabled = s.phase === "racing";
  els.startRaceBtn.textContent = s.phase === "results" ? "Start next race" : "Start race";
  els.oddsBoard.innerHTML = "";
  s.horses.forEach((h) => {
    const mine = player && player.bets ? (player.bets[h.id] || 0) : 0;
    const tickets = s.players.reduce((n, p) => n + ((p.bets && p.bets[h.id]) ? 1 : 0), 0);
    const row = document.createElement("button");
    row.className = "odd-row" + (mine ? " selected" : "");
    row.innerHTML = `<div class="dot" style="background:${h.color}">${h.emoji}</div><div>${h.name}${mine ? " · you $" + mine : ""}</div><div class="price">${h.odds}:1</div><div class="muted">${tickets} bets</div>`;
    row.onclick = () => {
      selectedHorse = h.id;
      if (s.phase === "betting") placeBet(h.id);
      else render(state);
    };
    els.oddsBoard.appendChild(row);
  });
  els.players.innerHTML = "";
  [...s.players].sort((a, b) => b.money - a.money).forEach((p) => {
    const li = document.createElement("li");
    const tickets = betList(p, s.horses);
    const bet = tickets.length ? tickets.join(", ") : p.lastPayout ? "won $" + p.lastPayout : "no bet";
    li.innerHTML = `<span class="${p.id === meId ? "you" : ""}">${p.name}${p.id === meId ? " (betting)" : ""}</span><span>$${p.money} · ${bet}</span>`;
    li.onclick = () => { meId = p.id; render(localRoom); };
    els.players.appendChild(li);
  });
  els.hostActions.innerHTML = "";
  const add = document.createElement("button"); add.className = "btn ghost";
  add.textContent = "Add player"; add.onclick = addLocalPlayer; els.hostActions.appendChild(add);
  els.betBar.hidden = s.phase !== "betting";
  renderTrack(s, s.phase === "racing");
}
function placeBet(horseId) {
  localAction("bet", { horseId, amount: Number(els.betAmt.value) });
}
els.clearBetBtn.onclick = () => localAction("clearBet");
els.startRaceBtn.onclick = onStartRace;
els.startRaceBtn2.onclick = onStartRace;
els.localBtn.onclick = startLocal;
els.nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") startLocal(); });
function startLocal() {
  const name = els.nameInput.value.trim() || "Player 1";
  meId = "p1";
  localRoom = { phase: "lobby", horses: generateField(), players: [newPlayer("p1", name)], race: null, bettingEndsAt: null, message: "Add players, then hit Start race." };
  els.gate.hidden = true; els.table.hidden = false; els.topMeta.hidden = false;
  render(localRoom);
}
function addLocalPlayer() {
  const n = prompt("Name for the next jockey?"); if (!n) return;
  localRoom.players.push(newPlayer("p" + (localRoom.players.length + 1), n.trim().slice(0, 16)));
  localRoom.message = n.trim() + " saddled up."; render(localRoom);
}
function localAction(name, payload) {
  const room = localRoom;
  if (name === "openBetting") {
    room.phase = "betting"; room.horses = generateField(); room.race = null;
    room.message = "Tap horses to split your cash. Then Start race.";
    room.players.forEach((p) => { p.bets = emptyBets(); p.lastPayout = 0; });
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
    if (!player.bets) player.bets = emptyBets();
    const amt = Math.floor(Number(payload.amount));
    const hid = Number(payload.horseId);
    if (!Number.isFinite(amt) || amt < MIN_BET) return;
    if (amt > player.money) return;
    player.money -= amt;
    player.bets[hid] = (player.bets[hid] || 0) + amt;
    render(room); return;
  }
  if (name === "clearBet") {
    const player = room.players.find((p) => p.id === meId);
    if (!player) return;
    player.money += betTotal(player);
    player.bets = emptyBets();
    render(room); return;
  }
  if (name === "startRaceNow") {
    if (room.phase !== "betting") return;
    clearInterval(tick); room.phase = "racing"; room.bettingEndsAt = null;
    room.race = simulateRace(room.horses); room.message = "They're off!"; render(room);
    setTimeout(() => {
      const winner = room.horses.find((h) => h.id === room.race.winner);
      room.players.forEach((p) => {
        const stake = (p.bets && p.bets[winner.id]) || 0;
        p.lastPayout = stake > 0 ? Math.round(stake * winner.odds) : 0;
        p.money += p.lastPayout;
        p.bets = emptyBets();
      });
      room.phase = "results"; room.message = winner.emoji + " " + winner.name + " wins at " + winner.odds + ":1!"; render(room);
    }, Math.ceil(room.race.duration * 1000) + 900);
  }
}
