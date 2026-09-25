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

function rand01() {
  return Math.round((0.01 + Math.random() * 0.99) * 100) / 100;
}

function draw(horses, animate) {
  track.innerHTML = "";
  horses.forEach((h) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    const horse = document.createElement("div");
    horse.className = "horse";
    horse.innerHTML = `<div class="silks" style="background:${h.color}">${h.emoji}</div><div class="label">${h.name}  ${h.roll.toFixed(2)}</div>`;
    lane.appendChild(horse);
    track.appendChild(lane);
    if (animate) {
      const time = 2.2 + (1 - h.roll) * 5.5;
      horse.style.transition = `transform ${time}s cubic-bezier(.15,.7,.3,1)`;
      requestAnimationFrame(() => { horse.style.transform = "translateX(92%)"; });
    }
  });
}

function rest() {
  racing = false;
  btn.disabled = false;
  btn.textContent = "Start race";
  const horses = HORSES.map((h) => ({ ...h, roll: rand01() }));
  draw(horses, false);
  msg.textContent = "";
  return horses;
}

let field = rest();

btn.onclick = () => {
  if (racing) return;
  racing = true;
  btn.disabled = true;
  field = HORSES.map((h) => ({ ...h, roll: rand01() }));
  field.sort((a, b) => b.roll - a.roll);
  draw(field, true);
  const winner = field[0];
  const duration = 2.2 + (1 - Math.min(...field.map((h) => h.roll))) * 5.5;
  msg.textContent = "They're off.";
  setTimeout(() => {
    msg.textContent = winner.emoji + " " + winner.name + "  " + winner.roll.toFixed(2);
    btn.disabled = false;
    btn.textContent = "Start race";
    racing = false;
  }, Math.ceil(duration * 1000) + 200);
};
