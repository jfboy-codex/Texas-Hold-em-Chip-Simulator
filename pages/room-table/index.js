const { getRoom, saveRoom, getUser } = require('../../utils/store');
const { applyAction, settleByWinners } = require('../../utils/poker');

function sumPickedChips(pickedChips) {
  return pickedChips.chip10 * 10 + pickedChips.chip20 * 20 + pickedChips.chip50 * 50;
}

function buildChipOptions(player) {
  const stacks = player && player.chipStacks ? player.chipStacks : { chip10: 0, chip20: 0, chip50: 0 };
  return [
    { key: 'chip10', value: 10, label: '10', colorClass: 'chip-10', remain: stacks.chip10 || 0 },
    { key: 'chip20', value: 20, label: '20', colorClass: 'chip-20', remain: stacks.chip20 || 0 },
    { key: 'chip50', value: 50, label: '50', colorClass: 'chip-50', remain: stacks.chip50 || 0 }
  ];
}

function addAmountToChipStacks(chipStacks, amount) {
  const next = {
    chip10: chipStacks.chip10 || 0,
    chip20: chipStacks.chip20 || 0,
    chip50: chipStacks.chip50 || 0
  };

  let rest = Math.max(0, Number(amount || 0));
  if (rest >= 50) {
    const count50 = Math.floor(rest / 50);
    next.chip50 += count50;
    rest -= count50 * 50;
  }
  if (rest >= 20) {
    const count20 = Math.floor(rest / 20);
    next.chip20 += count20;
    rest -= count20 * 20;
  }
  if (rest >= 10) {
    const count10 = Math.floor(rest / 10);
    next.chip10 += count10;
    rest -= count10 * 10;
  }
  return next;
}

Page({
  data: {
    room: null,
    chipOptions: [],
    pickedChips: { chip10: 0, chip20: 0, chip50: 0 },
    raiseAmount: 0,
    winnerIds: [],
    isOwner: false,
    chipAnimData: {}
  },

  onLoad(query) {
    const room = getRoom(query.roomId);
    const user = getUser();
    if (room && room.status !== 'playing') {
      wx.showToast({ title: '请先在房间内准备并开局', icon: 'none' });
      wx.navigateBack();
      return;
    }

    const me = room && user ? room.players.find((p) => p.id === user.id) : null;
    this.setData({
      room,
      chipOptions: buildChipOptions(me),
      isOwner: !!(room && user && room.ownerId === user.id)
    });
  },

  onShow() {
    if (!this.data.room) return;
    this.refreshRoom();
  },

  refreshRoom() {
    const room = getRoom(this.data.room.id);
    const user = getUser();
    const me = room && user ? room.players.find((p) => p.id === user.id) : null;
    this.setData({
      room,
      chipOptions: buildChipOptions(me)
    });
  },

  currentPlayer() {
    const user = getUser();
    return this.data.room.players.find((p) => p.id === user.id);
  },

  onTapPlayer(e) {
    const id = e.currentTarget.dataset.playerId;
    const p = this.data.room.players.find((x) => x.id === id);
    if (!p) return;
    const stacks = p.chipStacks || { chip10: 0, chip20: 0, chip50: 0 };
    wx.showModal({
      title: p.nickName,
      content: `当前总筹码：${p.chips}\n10筹码：${stacks.chip10}\n20筹码：${stacks.chip20}\n50筹码：${stacks.chip50}`,
      showCancel: false
    });
  },

  onPickChip(e) {
    const key = e.currentTarget.dataset.key;
    const picked = { ...this.data.pickedChips };
    const option = this.data.chipOptions.find((x) => x.key === key);
    if (!option) return;

    if (picked[key] >= option.remain) {
      wx.showToast({ title: '该面额筹码不足', icon: 'none' });
      return;
    }

    picked[key] += 1;
    this.setData({
      pickedChips: picked,
      raiseAmount: sumPickedChips(picked)
    });
    this.playChipAnim();
  },

  onResetPick() {
    this.setData({
      pickedChips: { chip10: 0, chip20: 0, chip50: 0 },
      raiseAmount: 0
    });
  },

  playChipAnim() {
    const anim = wx.createAnimation({ duration: 240, timingFunction: 'ease' });
    anim.translateX(120).scale(1.2).step();
    anim.translateX(0).scale(1).step();
    this.setData({ chipAnimData: anim.export() });
  },

  doAction(action) {
    const room = this.data.room;
    const user = getUser();
    if (!room || !user) return;
    const turnPlayer = room.players[room.currentTurn];
    if (!turnPlayer || turnPlayer.id !== user.id) {
      wx.showToast({ title: '未轮到你操作', icon: 'none' });
      return;
    }

    const amount = action === 'raise' ? this.data.raiseAmount : 0;
    const chipSpend = action === 'raise' ? this.data.pickedChips : null;
    if (action === 'raise' && amount <= 0) {
      wx.showToast({ title: '请先选择要下注的筹码', icon: 'none' });
      return;
    }

    applyAction(room, user.id, action, amount, chipSpend);
    saveRoom(room);
    this.setData({
      pickedChips: { chip10: 0, chip20: 0, chip50: 0 },
      raiseAmount: 0
    });
    this.refreshRoom();
  },

  onCheck() { this.doAction('check'); },
  onRaise() { this.doAction('raise'); },
  onFold() { this.doAction('fold'); },

  onWinnerChange(e) {
    this.setData({ winnerIds: e.detail.value || [] });
  },

  onSettle() {
    if (!this.data.isOwner) return;
    const room = this.data.room;
    const winners = this.data.winnerIds;
    if (!winners.length) {
      wx.showToast({ title: '请选择赢家', icon: 'none' });
      return;
    }

    const payout = settleByWinners(room.players, winners);
    room.players = room.players.map((p) => ({
      ...p,
      chips: p.chips + (payout[p.id] || 0),
      chipStacks: addAmountToChipStacks(p.chipStacks || {}, payout[p.id] || 0),
      invested: 0,
      folded: false,
      allIn: false
    }));
    room.pot = 0;
    room.actions.push({ type: 'settle', winners, payout, at: Date.now() });

    saveRoom(room);
    this.setData({ winnerIds: [] });
    this.refreshRoom();

    const summary = winners
      .map((id) => {
        const p = room.players.find((x) => x.id === id);
        return `${p ? p.nickName : id}: +${payout[id] || 0}`;
      })
      .join('\n');

    wx.showModal({ title: '结算完成', content: summary || '无', showCancel: false });
  }
});
