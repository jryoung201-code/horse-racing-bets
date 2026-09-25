const HORSES = [
  { id: 0, name: "Thunderbolt", color: "#e8c547", emoji: "\u26A1" },
  { id: 1, name: "Midnight Dash", color: "#3d4f7c", emoji: "\uD83C\uDF19" },
  { id: 2, name: "Lucky Star", color: "#3cb371", emoji: "\u2B50" },
  { id: 3, name: "Dust Devil", color: "#c44536", emoji: "\uD83C\uDF2A\uFE0F" },
  { id: 4, name: "Golden Hoof", color: "#d4a017", emoji: "\uD83C\uDFC6" },
  { id: 5, name: "Storm Chaser", color: "#2e86ab", emoji: "\uD83D\uDCA8" },
];

const TICK_MS = 10;
const MIN_STUDS = 1;
const MAX_STUDS = 4;

const track = document.getElementById("track");
const btn = document.getElementById("startRaceBtn");
const msg = document.getElementById("msg");

let racing = false;
let timer = null;
let field = [];

function rollStuds() {
  return MIN_STUDS + Math.floor(Math.random() * (MAX_STUDS - MIN_STUDS + 1));
}

function lineStuds() {
  const lane = track.querySelector(".lane");
  if (!lane) return 280;
  return Math.max(80, lane.clientWidth - 40);
}

function draw() {
  track.innerHTML = "";
  field.forEach((h) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    const horse = document.createElement("div");
    horse.className = "horse";
    horse.id = "h" + h.id;
    horse.innerHTML = `<div class="silks" style="background:${h.color}">${h.emoji}</div><div class="label">${h.name}</div>`;
    horse.style.transform = "translateX(" + h.studs + "px)";
    lane.appendChild(horse);
    track.appendChild(lane);
  });
}

function paint() {
  field.forEach((h) => {
    const el = document.getElementById("h" + h.id);
    if (el) el.style.transform = "translateX(" + h.studs + "px)";
  });
}

function rest() {
  racing = false;
  if (timer) clearInterval(timer);
  timer = null;
  btn.disabled = false;
  btn.textContent = "Start race";
  field = HORSES.map((h) => ({ ...h, studs: 0 }));
  draw();
  msg.textContent = "";
}

function tick() {
  const line = lineStuds();
  field.forEach((h) => {
    h.studs += rollStuds();
  });
  paint();
  const crossed = field.filter((h) => h.studs >= line);
  if (!crossed.length) return;
  crossed.sort((a, b) => b.studs - a.studs);
  const winner = crossed[0];
  clearInterval(timer);
  timer = null;
  racing = false;
  btn.disabled = false;
  msg.textContent = winner.emoji + " " + winner.name + " wins";
}

btn.onclick = () => {
  if (racing) return;
  rest();
  racing = true;
  btn.disabled = true;
  msg.textContent = "They're off.";
  timer = setInterval(tick, TICK_MS);
};

rest();
