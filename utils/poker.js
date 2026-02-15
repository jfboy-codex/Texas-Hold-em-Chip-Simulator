function nextActivePlayerIndex(players, from) {
  const len = players.length;
  for (let i = 1; i <= len; i += 1) {
    const idx = (from + i) % len;
    const p = players[idx];
    if (!p.folded && p.chips > 0) return idx;
  }
  return from;
}

function applyAction(room, playerId, action, amount = 0) {
  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return room;

  const player = room.players[idx];
  if (player.folded || player.allIn) return room;

  if (action === 'fold') {
    player.folded = true;
  }

  if (action === 'check') {
    // no-op
  }

  if (action === 'raise') {
    const realAmount = Math.max(0, Math.min(amount, player.chips));
    player.chips -= realAmount;
    player.invested += realAmount;
    room.pot += realAmount;
    if (player.chips === 0) player.allIn = true;
  }

  room.actions.push({
    playerId,
    action,
    amount,
    at: Date.now()
  });

  room.currentTurn = nextActivePlayerIndex(room.players, idx);
  return room;
}

function createSidePots(players) {
  const invested = players
    .filter((p) => p.invested > 0)
    .map((p) => ({ id: p.id, invested: p.invested, folded: p.folded }))
    .sort((a, b) => a.invested - b.invested);

  const sidePots = [];
  let prev = 0;
  for (let i = 0; i < invested.length; i += 1) {
    const level = invested[i].invested;
    const delta = level - prev;
    if (delta <= 0) continue;

    const contributors = invested.filter((x) => x.invested >= level).map((x) => x.id);
    sidePots.push({
      amount: delta * contributors.length,
      eligible: contributors.filter((id) => !invested.find((x) => x.id === id).folded)
    });
    prev = level;
  }
  return sidePots;
}

function settleByWinners(players, winnerIds) {
  const sidePots = createSidePots(players);
  const payout = {};
  players.forEach((p) => {
    payout[p.id] = 0;
  });

  sidePots.forEach((pot) => {
    const realWinners = winnerIds.filter((w) => pot.eligible.includes(w));
    if (!realWinners.length) return;

    const base = Math.floor(pot.amount / realWinners.length);
    let rem = pot.amount % realWinners.length;
    realWinners.forEach((w) => {
      payout[w] += base;
      if (rem > 0) {
        payout[w] += 1;
        rem -= 1;
      }
    });
  });

  return payout;
}

module.exports = {
  applyAction,
  nextActivePlayerIndex,
  createSidePots,
  settleByWinners
};
