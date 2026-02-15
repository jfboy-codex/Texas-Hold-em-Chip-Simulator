function nextActivePlayerIndex(players, from) {
  const len = players.length;
  for (let i = 1; i <= len; i += 1) {
    const idx = (from + i) % len;
    const p = players[idx];
    if (!p.folded && p.chips > 0) return idx;
  }
  return from;
}

const STAGES = ['preflop', 'flop', 'turn', 'river'];

function normalizeChipStacks(chipStacks = {}) {
  return {
    chip10: Math.max(0, Number(chipStacks.chip10 || 0)),
    chip20: Math.max(0, Number(chipStacks.chip20 || 0)),
    chip50: Math.max(0, Number(chipStacks.chip50 || 0))
  };
}

function sumChipStacks(chipStacks = {}) {
  const stacks = normalizeChipStacks(chipStacks);
  return stacks.chip10 * 10 + stacks.chip20 * 20 + stacks.chip50 * 50;
}

function markPlayerActed(player) {
  player.actedInStage = true;
}

function isBettingRoundComplete(room) {
  const activePlayers = room.players.filter((p) => !p.folded && !p.allIn);
  if (!activePlayers.length) return true;
  return activePlayers.every((p) => p.actedInStage);
}

function advanceStage(room) {
  const index = STAGES.indexOf(room.stage);
  if (index < 0 || index === STAGES.length - 1) return;
  room.stage = STAGES[index + 1];
  room.players.forEach((p) => {
    p.actedInStage = false;
    p.stageBet = 0;
  });
  const startFrom = typeof room.smallBlindIndex === 'number' ? room.smallBlindIndex : room.currentTurn;
  room.currentTurn = nextActivePlayerIndex(room.players, (startFrom - 1 + room.players.length) % room.players.length);
}

function collectBet(room, player, amount, chipSpend) {
  const realAmount = Math.max(0, Math.min(amount, player.chips));
  const stacks = normalizeChipStacks(player.chipStacks);
  const spend = normalizeChipStacks(chipSpend);
  const spendAmount = sumChipStacks(spend);
  if (spendAmount !== realAmount) {
    return 0;
  }
  if (spend.chip10 > stacks.chip10 || spend.chip20 > stacks.chip20 || spend.chip50 > stacks.chip50) {
    return 0;
  }

  player.chipStacks = {
    chip10: stacks.chip10 - spend.chip10,
    chip20: stacks.chip20 - spend.chip20,
    chip50: stacks.chip50 - spend.chip50
  };
  player.chips -= realAmount;
  player.invested += realAmount;
  player.stageBet = (player.stageBet || 0) + realAmount;
  room.pot += realAmount;
  room.potChipStacks = normalizeChipStacks(room.potChipStacks);
  room.potChipStacks.chip10 += spend.chip10;
  room.potChipStacks.chip20 += spend.chip20;
  room.potChipStacks.chip50 += spend.chip50;
  if (player.chips === 0) player.allIn = true;
  return realAmount;
}

function applyAction(room, playerId, action, amount = 0, chipSpend = null) {
  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return room;

  const player = room.players[idx];
  if (player.folded || player.allIn) return room;

  if (action === 'fold') {
    player.folded = true;
    markPlayerActed(player);
  }

  if (action === 'check') {
    markPlayerActed(player);
  }

  if (action === 'raise') {
    const realAmount = collectBet(room, player, amount, chipSpend || {});
    if (realAmount <= 0) return room;
    markPlayerActed(player);
  }

  room.actions.push({
    playerId,
    action,
    amount: action === 'raise' ? amount : 0,
    at: Date.now()
  });

  const alivePlayers = room.players.filter((p) => !p.folded);
  if (alivePlayers.length <= 1) {
    return room;
  }

  if (isBettingRoundComplete(room)) {
    advanceStage(room);
    return room;
  }

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

    const unit = 10;
    const totalUnits = Math.floor(pot.amount / unit);
    const base = Math.floor(totalUnits / realWinners.length) * unit;
    let remUnits = totalUnits % realWinners.length;
    realWinners.forEach((w) => {
      payout[w] += base;
      if (remUnits > 0) {
        payout[w] += unit;
        remUnits -= 1;
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
