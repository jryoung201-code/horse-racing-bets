const TICK_MS = 10;
const MIN_STUDS = 1;
const MAX_STUDS = 4;

const DEFAULTS = [
  { name: "Thunderbolt", color: "#5c3317" },
  { name: "Midnight", color: "#1a1a1a" },
  { name: "Chestnut", color: "#a0522d" },
  { name: "Palomino", color: "#d4a017" },
];

const track = document.getElementById("track");
const btn = document.getElementById("startRaceBtn");
const msg = document.getElementById("msg");
const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("horseName");
const colorInput = document.getElementById("horseColor");

let nextId = 1;
let roster = DEFAULTS.map((h) => ({ ...h, id: nextId++ }));
let racing = false;
let timer = null;
let field = [];

function horseSvg(color) {
  return `<svg class="pony" viewBox="0 0 140 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g fill="${color}">
      <path d="M18 28c6-10 14-16 22-14 4 8 8 12 10 12l-4 8c-10 2-20 4-28 2 0-4 0-6 0-8z"/>
      <path d="M38 28c18-4 42-2 62 8 10 5 16 12 16 18-18 2-48 4-78 0-2-8 0-18 0-26z"/>
      <path d="M96 34c10-2 16-10 22-22 2-1 6 2 6 6-6 8-10 16-8 24-8 2-16 2-20-8z"/>
      <path d="M112 18c6-2 10-1 14 4 1 4-2 6-6 6-6-2-10-4-8-10z"/>
      <rect x="46" y="50" width="7" height="24" rx="2"/>
      <rect x="60" y="52" width="7" height="22" rx="2"/>
      <rect x="78" y="52" width="7" height="22" rx="2"/>
      <rect x="90" y="50" width="7" height="24" rx="2"/>
    </g>
    <g fill="#1a120c" opacity=".55">
      <path d="M20 22c8-8 16-12 24-8-4 6-10 10-18 12-4 0-6-2-6-4z"/>
      <path d="M14 30c-8 6-12 16-10 20 6-2 12-10 14-18-2-2-4-2-4-2z"/>
      <ellipse cx="124" cy="16" rx="2" ry="2" fill="#111"/>
    </g>
    <rect x="46" y="70" width="8" height="4" rx="1" fill="#2b1a10"/>
    <rect x="60" y="70" width="8" height="4" rx="1" fill="#2b1a10"/>
    <rect x="78" y="70" width="8" height="4" rx="1" fill="#2b1a10"/>
    <rect x="90" y="70" width="8" height="4" rx="1" fill="#2b1a10"/>
  </svg>`;
}

function rollStuds() {
  return MIN_STUDS + Math.floor(Math.random() * (MAX_STUDS - MIN_STUDS + 1));
}

function lineStuds() {
  const lane = track.querySelector(".lane");
  if (!lane) return 280;
  return Math.max(80, lane.clientWidth - 96);
}

function draw() {
  track.innerHTML = "";
  field.forEach((h) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    const rm = document.createElement("button");
    rm.className = "rm";
    rm.type = "button";
    rm.textContent = "×";
    rm.disabled = racing;
    rm.onclick = () => removeHorse(h.id);
    const horse = document.createElement("div");
    horse.className = "horse";
    horse.id = "h" + h.id;
    horse.innerHTML = horseSvg(h.color) + `<div class="label">${h.name}</div>`;
    horse.style.transform = "translateX(" + h.studs + "px)";
    lane.appendChild(rm);
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
  if (timer) clearInterval(timer);
  timer = null;
  racing = false;
  btn.disabled = roster.length < 2;
  field = roster.map((h) => ({ ...h, studs: 0 }));
  draw();
}

function removeHorse(id) {
  if (racing) return;
  roster = roster.filter((h) => h.id !== id);
  rest();
}

function tick() {
  const line = lineStuds();
  field.forEach((h) => { h.studs += rollStuds(); });
  paint();
  const crossed = field.filter((h) => h.studs >= line);
  if (!crossed.length) return;
  crossed.sort((a, b) => b.studs - a.studs);
  const winner = crossed[0];
  clearInterval(timer);
  timer = null;
  racing = false;
  btn.disabled = roster.length < 2;
  draw();
  msg.textContent = winner.name + " wins";
}

btn.onclick = () => {
  if (racing || roster.length < 2) return;
  rest();
  racing = true;
  btn.disabled = true;
  draw();
  msg.textContent = "They're off.";
  timer = setInterval(tick, TICK_MS);
};

addForm.onsubmit = (e) => {
  e.preventDefault();
  if (racing) return;
  const name = nameInput.value.trim() || "Horse " + nextId;
  roster.push({ id: nextId++, name, color: colorInput.value });
  nameInput.value = "";
  rest();
  msg.textContent = "";
};

rest();
