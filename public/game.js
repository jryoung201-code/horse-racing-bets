const HORSES = [
  { id: 0, name: "Thunderbolt", color: "#e8c547", emoji: "\u26A1" },
  { id: 1, name: "Midnight Dash", color: "#3d4f7c", emoji: "\uD83C\uDF19" },
  { id: 2, name: "Lucky Star", color: "#3cb371", emoji: "\u2B50" },
  { id: 3, name: "Dust Devil", color: "#c44536", emoji: "\uD83C\uDF2A\uFE0F" },
  { id: 4, name: "Golden Hoof", color: "#d4a017", emoji: "\uD83C\uDFC6" },
  { id: 5, name: "Storm Chaser", color: "#2e86ab", emoji: "\uD83D\uDCA8" },
];

const track = document.getElementById("track");
const btn = document.getElementById("startRaceBtn");
const msg = document.getElementById("msg");

let racing = false;
let timer = null;
let field = [];

function randPx() {
  return Math.round((0.01 + Math.random() * 0.99) * 100) / 100;
}

function finishLine() {
  const lane = track.querySelector(".lane");
  if (!lane) return 300;
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
    horse.innerHTML = `<div class="silks" style="background:${h.color}">${h.emoji}</div><div class="label">${h.name}  ${h.roll.toFixed(2)}</div>`;
    horse.style.transform = "translateX(" + h.x + "px)";
    lane.appendChild(horse);
    track.appendChild(lane);
  });
}

function rest() {
  racing = false;
  if (timer) clearInterval(timer);
  timer = null;
  btn.disabled = false;
  btn.textContent = "Start race";
  field = HORSES.map((h) => ({ ...h, x: 0, roll: randPx() }));
  draw();
  msg.textContent = "";
}

function tick() {
  const line = finishLine();
  let winner = null;
  field.forEach((h) => {
    h.roll = randPx();
    h.x += h.roll;
    if (!winner && h.x >= line) winner = h;
  });
  field.forEach((h) => {
    const el = document.getElementById("h" + h.id);
    if (!el) return;
    el.style.transform = "translateX(" + h.x + "px)";
    const label = el.querySelector(".label");
    if (label) label.textContent = h.name + "  " + h.roll.toFixed(2);
  });
  if (winner) {
    clearInterval(timer);
    timer = null;
    racing = false;
    btn.disabled = false;
    msg.textContent = winner.emoji + " " + winner.name;
  }
}

btn.onclick = () => {
  if (racing) return;
  rest();
  racing = true;
  btn.disabled = true;
  msg.textContent = "They're off.";
  timer = setInterval(tick, 10);
};

rest();
