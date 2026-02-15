const { getRoom, saveRoom, getUser } = require('../../utils/store');
const { applyAction, settleByWinners } = require('../../utils/poker');

Page({
  data: {
    room: null,
    chipOptions: [10, 20, 50, 100, 500],
    raiseAmount: 0,
    winnerIds: [],
    isOwner: false,
    chipAnimData: {}
  },

  onLoad(query) {
    const room = getRoom(query.roomId);
    const user = getUser();
    this.setData({
      room,
      isOwner: !!(room && user && room.ownerId === user.id)
    });
  },

  onShow() {
    if (!this.data.room) return;
    this.refreshRoom();
  },

  refreshRoom() {
    const room = getRoom(this.data.room.id);
    this.setData({ room });
  },

  currentPlayer() {
    const user = getUser();
    return this.data.room.players.find((p) => p.id === user.id);
  },

  onTapPlayer(e) {
    const id = e.currentTarget.dataset.playerId;
    const p = this.data.room.players.find((x) => x.id === id);
    if (!p) return;
    wx.showModal({
      title: p.nickName,
      content: `当前总筹码：${p.chips}`,
      showCancel: false
    });
  },

  onPickChip(e) {
    const chip = Number(e.currentTarget.dataset.chip || 0);
    this.setData({ raiseAmount: this.data.raiseAmount + chip });
    this.playChipAnim();
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
    applyAction(room, user.id, action, amount);
    saveRoom(room);
    this.setData({ raiseAmount: 0 });
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
