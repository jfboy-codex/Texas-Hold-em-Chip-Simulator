const {
  getRoom,
  saveRoom,
  getUser,
  updatePlayerInRoom,
  updateUserNickName,
  areAllPlayersReady
} = require('../../utils/store');
const { nextActivePlayerIndex } = require('../../utils/poker');

function buildSeatList(room) {
  const list = [];
  for (let i = 1; i <= room.maxSeats; i += 1) {
    const player = room.players.find((p) => p.seat === i) || null;
    list.push({ seat: i, player });
  }
  return list;
}

Page({
  data: {
    room: null,
    seatList: [],
    isOwner: false,
    canStart: false,
    myReady: false,
    nickNameInput: '',
    qrVisible: false,
    qrImageUrl: '',
    inviteText: ''
  },

  onLoad(query) {
    this.roomId = query.roomId;
    this.refresh();
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const room = getRoom(this.roomId);
    const user = getUser();
    if (!room || !user) return;

    const me = room.players.find((p) => p.id === user.id);
    const inviteText = `holdem://join?room=${room.id}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(inviteText)}`;

    this.setData({
      room,
      seatList: buildSeatList(room),
      isOwner: room.ownerId === user.id,
      canStart: areAllPlayersReady(room),
      myReady: !!(me && me.ready),
      nickNameInput: user.nickName,
      inviteText,
      qrImageUrl
    });
  },

  onShareAppMessage() {
    const room = this.data.room;
    if (!room) {
      return { title: '加入德州扑克房间', path: '/pages/lobby/index' };
    }
    return {
      title: `加入房间 ${room.id}`,
      path: `/pages/room-join/index?room=${room.id}`
    };
  },

  onNickInput(e) {
    this.setData({ nickNameInput: e.detail.value || '' });
  },

  onUpdateNick() {
    const nickName = (this.data.nickNameInput || '').trim();
    if (!nickName) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    const user = getUser();
    const nextUser = updateUserNickName(nickName);
    if (!user || !nextUser) return;

    const room = updatePlayerInRoom(this.roomId, user.id, { nickName });
    if (!room) return;

    getApp().globalData.currentUser = nextUser;
    this.refresh();
    wx.showToast({ title: '昵称已更新', icon: 'none' });
  },

  toggleReady() {
    const user = getUser();
    const room = this.data.room;
    if (!user || !room) return;

    const me = room.players.find((p) => p.id === user.id);
    if (!me) return;

    updatePlayerInRoom(this.roomId, user.id, { ready: !me.ready });
    this.refresh();
  },

  showQr() {
    this.setData({ qrVisible: true });
  },

  hideQr() {
    this.setData({ qrVisible: false });
  },

  goTable() {
    const room = getRoom(this.roomId);
    const user = getUser();
    if (!room || !user || room.ownerId !== user.id) return;
    if (!areAllPlayersReady(room)) {
      wx.showToast({ title: '请等待全部玩家准备', icon: 'none' });
      return;
    }

    const playerCount = room.players.length;
    const smallBlindIndex = playerCount > 1 ? 0 : 0;
    const bigBlindIndex = playerCount > 1 ? 1 : 0;

    room.players = room.players.map((player, index) => ({
      ...player,
      invested: 0,
      stageBet: 0,
      folded: false,
      allIn: false,
      actedInStage: false,
      position: index === smallBlindIndex ? 'small_blind' : (index === bigBlindIndex ? 'big_blind' : 'normal')
    }));
    room.smallBlindIndex = smallBlindIndex;
    room.bigBlindIndex = bigBlindIndex;
    room.currentTurn = nextActivePlayerIndex(room.players, bigBlindIndex);
    room.stage = 'preflop';
    room.pot = 0;
    room.potChipStacks = { chip10: 0, chip20: 0, chip50: 0 };
    room.status = 'playing';
    room.actions.push({ type: 'start_game', at: Date.now() });
    saveRoom(room);
    wx.navigateTo({ url: `/pages/room-table/index?roomId=${room.id}` });
  }
});
