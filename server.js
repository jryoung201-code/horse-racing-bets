const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const STARTING_CASH = 100;
const MIN_BET = 5;
const MAX_PLAYERS = 8;
const BETTING_SECONDS = 30;

const HORSES = [
  { id: 0, name: "Thunderbolt", color: "#e8c547", emoji: "⚡" },
  { id: 1, name: "Midnight Dash", color: "#3d4f7c", emoji: "🌙" },
  { id: 2, name: "Lucky Star", color: "#3cb371", emoji: "⭐" },
  { id: 3, name: "Dust Devil", color: "#c44536", emoji: "🌪️" },
  { id: 4, name: "Golden Hoof", color: "#d4a017", emoji: "🏆" },
  { id: 5, name: "Storm Chaser", color: "#2e86ab", emoji: "💨" },
];

const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function publicState(room) {
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    horses: room.horses,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      money: p.money,
      betHorse: p.betHorse,
      betAmount: p.betAmount,
      lastPayout: p.lastPayout,
    })),
    race: room.race,
    bettingEndsAt: room.bettingEndsAt,
    message: room.message,
  };
}

function emit(room) {
  io.to(room.code).emit("state", publicState(room));
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

function settle(room) {
  const winner = room.race.winner;
  const horse = room.horses.find((h) => h.id === winner);
  room.players.forEach((p) => {
    p.lastPayout = 0;
    if (p.betHorse === winner && p.betAmount > 0) {
      p.lastPayout = Math.round(p.betAmount * horse.odds);
      p.money += p.lastPayout;
    }
    p.betHorse = null;
    p.betAmount = 0;
  });
}

function clearTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function startBetting(room) {
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
  clearTimer(room);
  room.timer = setTimeout(() => startRace(room), BETTING_SECONDS * 1000);
  emit(room);
}

function startRace(room) {
  if (room.phase !== "betting") return;
  clearTimer(room);
  room.phase = "racing";
  room.bettingEndsAt = null;
  room.race = simulateRace(room.horses);
  room.message = "They're off!";
  emit(room);
  const wait = Math.ceil(room.race.duration * 1000) + 900;
  room.timer = setTimeout(() => {
    room.phase = "results";
    settle(room);
    const winner = room.horses.find((h) => h.id === room.race.winner);
    room.message = `${winner.emoji} ${winner.name} wins at ${winner.odds}:1!`;
    emit(room);
  }, wait);
}

io.on("connection", (socket) => {
  socket.on("create", ({ name }) => {
    const n = String(name || "").trim().slice(0, 16);
    if (!n) return socket.emit("errorMsg", "Enter a name.");
    let roomCode = code();
    while (rooms.has(roomCode)) roomCode = code();
    const room = {
      code: roomCode,
      hostId: socket.id,
      phase: "lobby",
      horses: generateField(),
      players: [
        {
          id: socket.id,
          name: n,
          money: STARTING_CASH,
          betHorse: null,
          betAmount: 0,
          lastPayout: 0,
        },
      ],
      race: null,
      bettingEndsAt: null,
      message: "Waiting for players…",
      timer: null,
    };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.room = roomCode;
    emit(room);
  });

  socket.on("join", ({ code: raw, name }) => {
    const roomCode = String(raw || "").trim().toUpperCase();
    const n = String(name || "").trim().slice(0, 16);
    const room = rooms.get(roomCode);
    if (!room) return socket.emit("errorMsg", "Room not found.");
    if (!n) return socket.emit("errorMsg", "Enter a name.");
    if (room.players.length >= MAX_PLAYERS) return socket.emit("errorMsg", "Room is full.");
    if (room.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) {
      return socket.emit("errorMsg", "That name is taken in this room.");
    }
    room.players.push({
      id: socket.id,
      name: n,
      money: STARTING_CASH,
      betHorse: null,
      betAmount: 0,
      lastPayout: 0,
    });
    socket.join(roomCode);
    socket.data.room = roomCode;
    room.message = `${n} saddled up.`;
    emit(room);
  });

  socket.on("openBetting", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== "lobby" && room.phase !== "results") return;
    startBetting(room);
  });

  socket.on("startRaceNow", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== "betting") return;
    startRace(room);
  });

  socket.on("bet", ({ horseId, amount }) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.phase !== "betting") return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    const hid = Number(horseId);
    const amt = Math.floor(Number(amount));
    if (!room.horses.some((h) => h.id === hid)) return;
    if (!Number.isFinite(amt) || amt < MIN_BET) {
      return socket.emit("errorMsg", `Minimum bet is $${MIN_BET}.`);
    }
    const available = player.money + (player.betAmount || 0);
    if (amt > available) return socket.emit("errorMsg", "Not enough cash.");
    if (player.betAmount) player.money += player.betAmount;
    player.money -= amt;
    player.betHorse = hid;
    player.betAmount = amt;
    emit(room);
  });

  socket.on("clearBet", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.phase !== "betting") return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || !player.betAmount) return;
    player.money += player.betAmount;
    player.betHorse = null;
    player.betAmount = 0;
    emit(room);
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.room;
    const room = rooms.get(roomCode);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== socket.id);
    if (!room.players.length) {
      clearTimer(room);
      rooms.delete(roomCode);
      return;
    }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    emit(room);
  });
});

server.listen(PORT, () => {
  console.log(`Horse Racing Bets running at http://localhost:${PORT}`);
});
