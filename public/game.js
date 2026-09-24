const STARTING_CASH = 100;
const MIN_BET = 5;
const BETTING_SECONDS = 30;

const HORSES = [
  { id: 0, name: "Thunderbolt", color: "#e8c547", emoji: "⚡" },
  { id: 1, name: "Midnight Dash", color: "#3d4f7c", emoji: "🌙" },
  { id: 2, name: "Lucky Star", color: "#3cb371", emoji: "⭐" },
  { id: 3, name: "Dust Devil", color: "#c44536", emoji: "🌪️" },
  { id: 4, name: "Golden Hoof", color: "#d4a017", emoji: "🏆" },
  { id: 5, name: "Storm Chaser", color: "#2e86ab", emoji: "💨" },
];

const els = {
  gate: document.getElementById("gate"),
  table: document.getElementById("table"),
  topMeta: document.getElementById("topMeta"),
  roomPill: document.getElementById("roomPill"),
  cashPill: document.getElementById("cashPill"),
  nameInput: document.getElementById("nameInput"),
  codeInput: document.getElementById("codeInput"),
  createBtn: document.getElementById("createBtn"),
  joinBtn: document.getElementById("joinBtn"),
  localBtn: document.getElementById("localBtn"),
  gateError: document.getElementById("gateError"),
  track: document.getElementById("track"),
  oddsBoard: document.getElementById("oddsBoard"),
  players: document.getElementById("players"),
  hostActions: document.getElementById("hostActions"),
  phaseLabel: document.getElementById("phaseLabel"),
  bannerMsg: document.getElementById("bannerMsg"),
  timer: document.getElementById("timer"),
  betBar: document.getElementById("betBar"),
  betAmt: document.getElementById("betAmt"),
  clearBetBtn: document.getElementById("clearBetBtn"),
};

let socket = null;
let meId = null;
let state = null;
let selectedHorse = 0;
let localMode = false;
let localRoom = null;
let tick = null;

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
  let r = Math.random() * total;
  let winner = horses[0].id;
  for (let i = 0; i < horses.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      winner = horses[i].id;
      break;
    }
  }
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
    const tmp = w.time;
    w.time = first.time - 0.12;
    first.time = tmp;
    finishes.sort((a, b) => a.time - b.time);
  }
  return { winner, finishes, duration: Math.max(...finishes.map((f) => f.time)) };
}

function showTable() {
  els.gate.hidden = true;
  els.table.hidden = false;
  els.topMeta.hidden = false;
}

function renderTrack(s, animate = false) {
  els.track.innerHTML = "";
  s.horses.forEach((h, idx) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    const horse = document.createElement("div");
    horse.className = "horse";
    horse.id = `horse-${h.id}`;
    horse.innerHTML = `<div class="silks" style="background:${h.color}">${h.emoji}</div><div class="label">${idx + 1}. ${h.name}</div>`;
    lane.appendChild(horse);
    els.track.appendChild(lane);

    if (animate && s.race) {
      const fin = s.race.finishes.find((f) => f.id === h.id);
      horse.style.transition = `transform ${fin.time}s cubic-bezier(.15,.7,.3,1)`;
      requestAnimationFrame(() => {
        horse.style.transform = "translateX(92%)";
      });
    } else {
      horse.style.transform = "translateX(0)";
    }
  });
}

function me(s) {
  return s.players.find((p) => p.id === meId);
}

function render(s) {
  state = s;
  const player = me(s);
  els.roomPill.textContent = localMode ? "LOCAL TABLE" : `ROOM ${s.code}`;
  els.cashPill.textContent = player ? `$${player.money}` : "$0";
  els.phaseLabel.textContent = s.phase.toUpperCase();
  els.bannerMsg.textContent = s.message || "";

  if (s.phase === "betting" && s.bettingEndsAt) {
    const left = Math.max(0, Math.ceil((s.bettingEndsAt - Date.now()) / 1000));
    els.timer.textContent = `${left}s`;
  } else {
    els.timer.textContent = "";
  }

  els.oddsBoard.innerHTML = "";
  s.horses.forEach((h) => {
    const row = document.createElement("button");
    row.className = "odd-row" + (selectedHorse === h.id ? " selected" : "");
    row.innerHTML = `<div class="dot" style="background:${h.color}">${h.emoji}</div>
      <div>${h.name}</div>
      <div class="price">${h.odds}:1</div>
      <div class="muted">${s.players.filter((p) => p.betHorse === h.id).length} bets</div>`;
    row.onclick = () => {
      selectedHorse = h.id;
      if (s.phase === "betting") placeBet();
      render(state);
    };
    els.oddsBoard.appendChild(row);
  });

  els.players.innerHTML = "";
  [...s.players].sort((a, b) => b.money - a.money).forEach((p) => {
    const li = document.createElement("li");
    const bet = p.betAmount
      ? `bet $${p.betAmount} on ${s.horses.find((h) => h.id === p.betHorse)?.name || "?"}`
      : p.lastPayout
        ? `won $${p.lastPayout}`
        : "no bet";
    li.innerHTML = `<span class="${p.id === meId ? "you" : ""}">${p.name}${p.id === s.hostId ? " ★" : ""}${localMode && p.id === meId ? " (betting)" : ""}</span><span>$${p.money} · ${bet}</span>`;
    if (localMode) {
      li.style.cursor = "pointer";
      li.title = "Click to place bets as this player";
      li.onclick = () => {
        meId = p.id;
        render(localRoom);
      };
    }
    els.players.appendChild(li);
  });

  const isHost = localMode || s.hostId === meId;
  els.hostActions.innerHTML = "";
  if (isHost && (s.phase === "lobby" || s.phase === "results")) {
    const b = document.createElement("button");
    b.className = "btn gold";
    b.textContent = s.phase === "lobby" ? "Open betting" : "Next race";
    b.onclick = () => action("openBetting");
    els.hostActions.appendChild(b);
  }
  if (isHost && s.phase === "betting") {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = "Start race now";
    b.onclick = () => action("startRaceNow");
    els.hostActions.appendChild(b);
  }
  if (localMode) {
    const add = document.createElement("button");
    add.className = "btn ghost";
    add.textContent = "Add local player";
    add.onclick = addLocalPlayer;
    els.hostActions.appendChild(add);
  }

  els.betBar.hidden = s.phase !== "betting";
  renderTrack(s, s.phase === "racing");
}

function action(name, payload) {
  if (localMode) return localAction(name, payload);
  socket.emit(name, payload);
}

function placeBet() {
  const amt = Number(els.betAmt.value);
  if (localMode) localAction("bet", { horseId: selectedHorse, amount: amt });
  else socket.emit("bet", { horseId: selectedHorse, amount: amt });
}

els.clearBetBtn.onclick = () => action("clearBet");
els.betAmt.addEventListener("change", () => {
  if (state && state.phase === "betting") placeBet();
});

function connectSocket() {
  if (typeof io !== "function") return null;
  const s = io();
  s.on("connect", () => { meId = s.id; });
  s.on("state", (st) => {
    showTable();
    render(st);
  });
  s.on("errorMsg", (msg) => {
    els.gateError.textContent = msg;
  });
  return s;
}

els.createBtn.onclick = () => {
  const name = els.nameInput.value.trim();
  if (!name) return (els.gateError.textContent = "Enter a name.");
  localMode = false;
  socket = socket || connectSocket();
  if (!socket) return (els.gateError.textContent = "Server not running. Use local mode or npm start.");
  socket.emit("create", { name });
};

els.joinBtn.onclick = () => {
  const name = els.nameInput.value.trim();
  const code = els.codeInput.value.trim();
  if (!name || !code) return (els.gateError.textContent = "Name and room code required.");
  localMode = false;
  socket = socket || connectSocket();
  if (!socket) return (els.gateError.textContent = "Server not running. Use local mode or npm start.");
  socket.emit("join", { name, code });
};

els.localBtn.onclick = startLocal;
els.codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.joinBtn.click();
});
els.nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.createBtn.click();
});

function startLocal() {
  const name = els.nameInput.value.trim() || "Player 1";
  localMode = true;
  meId = "p1";
  localRoom = {
    code: "LOCAL",
    hostId: "p1",
    phase: "lobby",
    horses: generateField(),
    players: [{ id: "p1", name, money: STARTING_CASH, betHorse: null, betAmount: 0, lastPayout: 0 }],
    race: null,
    bettingEndsAt: null,
    message: "Local table. Add players, then open betting.",
  };
  showTable();
  render(localRoom);
}

function addLocalPlayer() {
  const n = prompt("Name for the next jockey?");
  if (!n) return;
  const id = "p" + (localRoom.players.length + 1);
  localRoom.players.push({
    id,
    name: n.trim().slice(0, 16),
    money: STARTING_CASH,
    betHorse: null,
    betAmount: 0,
    lastPayout: 0,
  });
  localRoom.message = `${n.trim()} saddled up.`;
  render(localRoom);
}

function localAction(name, payload) {
  const room = localRoom;
  if (name === "openBetting") {
    room.phase = "betting";
    room.horses = generateField();
    room.race = null;
    room.message = "Place your bets!";
    room.players.forEach((p) => {
      p.betHorse = null;
      p.betAmount = 0;
      p.lastPayout = 0;
    });
    room.bettingEndsAt = Date.now() + BETTING_SECONDS * 1000;
    render(room);
    clearInterval(tick);
    tick = setInterval(() => {
      if (!localRoom || localRoom.phase !== "betting") return;
      const left = Math.max(0, Math.ceil((localRoom.bettingEndsAt - Date.now()) / 1000));
      els.timer.textContent = left + "s";
      if (Date.now() >= localRoom.bettingEndsAt) {
        clearInterval(tick);
        localAction("startRaceNow");
      }
    }, 250);
    return;
  }
  if (name === "bet") {
    if (room.phase !== "betting") return;
    const player = room.players.find((p) => p.id === meId);
    const amt = Math.floor(Number(payload.amount));
    if (!Number.isFinite(amt) || amt < MIN_BET || amt > player.money + (player.betAmount || 0)) {
      els.gateError.textContent = "Invalid bet.";
      return;
    }
    if (player.betAmount) player.money += player.betAmount;
    player.money -= amt;
    player.betHorse = Number(payload.horseId);
    player.betAmount = amt;
    render(room);
    return;
  }
  if (name === "clearBet") {
    const player = room.players.find((p) => p.id === meId);
    if (!player?.betAmount) return;
    player.money += player.betAmount;
    player.betHorse = null;
    player.betAmount = 0;
    render(room);
    return;
  }
  if (name === "startRaceNow") {
    if (room.phase !== "betting") return;
    clearInterval(tick);
    room.phase = "racing";
    room.bettingEndsAt = null;
    room.race = simulateRace(room.horses);
    room.message = "They're off!";
    render(room);
    setTimeout(() => {
      const winner = room.horses.find((h) => h.id === room.race.winner);
      room.players.forEach((p) => {
        p.lastPayout = 0;
        if (p.betHorse === winner.id && p.betAmount > 0) {
          p.lastPayout = Math.round(p.betAmount * winner.odds);
          p.money += p.lastPayout;
        }
        p.betHorse = null;
        p.betAmount = 0;
      });
      room.phase = "results";
      room.message = `${winner.emoji} ${winner.name} wins at ${winner.odds}:1!`;
      render(room);
    }, Math.ceil(room.race.duration * 1000) + 900);
  }
}

if (typeof io === "function") {
  socket = connectSocket();
}
