# Horse Racing Bets

Multiplayer horse racing betting game. **Everyone starts with $100.**

Create a room, share the 4-letter code, pick a horse, and watch the field run. Favorites pay less; long shots pay more. The house uses weighted odds so the favorite wins more often — but not always.

## Play online with friends (same Wi‑Fi or a hosted server)

```bash
git clone https://github.com/jryoung201-code/horse-racing-bets.git
cd horse-racing-bets
npm install
npm start
```

Open **http://localhost:3000** on every device.

1. One person clicks **Create room** and shares the code.
2. Everyone else enters their name + the code and hits **Join**.
3. Host clicks **Open betting**.
4. Tap a horse, set a stake (min $5), and wait for the bell — or the host can start the race early.
5. Winner is paid `bet × odds`. Broke players sit out until they… stay broke. Play another race from the results screen.

## Same-device / party mode

On the home screen choose **Play local multiplayer (same device)**.

- Add extra jockeys with **Add local player**.
- Click a name on the jockey list to bet as that person.
- Host (first player) opens betting and starts races.

This mode also works if the Node server is not running.

## Rules

| | |
|---|---|
| Bankroll | $100 each at sit-down |
| Min bet | $5 |
| Max bet | whatever you still have |
| Payout | stake × listed odds if your horse wins |
| Field | 6 horses, fresh odds every race |
| Cap | 8 players per room |

Losing tickets are burned. Winning tickets are paid from the track, not from other players’ pockets — this is a tote board against the house odds, not a player-vs-player pot.

## Stack

- Node.js + Express
- Socket.IO rooms
- Vanilla HTML / CSS / JS (no build step)

## Deploy

Any host that can run `node server.js` works (Render, Railway, Fly.io, a Raspberry Pi). Set `PORT` if the platform needs it.

---

Built for JR Young.
