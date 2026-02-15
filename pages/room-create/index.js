const { getUser, createRoom } = require('../../utils/store');

Page({
  data: {
    initialChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
    orderText: '',
    room: null
  },

  onInitialChips(e) { this.setData({ initialChips: Number(e.detail.value || 0) }); },
  onSmallBlind(e) { this.setData({ smallBlind: Number(e.detail.value || 0) }); },
  onBigBlind(e) { this.setData({ bigBlind: Number(e.detail.value || 0) }); },
  onOrderText(e) { this.setData({ orderText: e.detail.value || '' }); },

  onCreateRoom() {
    const owner = getUser();
    if (!owner) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const names = this.data.orderText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    const orderedPlayers = names.length
      ? names.map((n, i) => ({
          id: i === 0 ? owner.id : `guest_${Date.now()}_${i}`,
          nickName: i === 0 ? owner.nickName : n,
          avatarUrl: owner.avatarUrl
        }))
      : [owner];

    const room = createRoom({
      owner,
      initialChips: this.data.initialChips,
      smallBlind: this.data.smallBlind,
      bigBlind: this.data.bigBlind,
      orderedPlayers
    });

    getApp().globalData.currentRoomId = room.id;
    this.setData({ room });
  },

  goRoom() {
    if (!this.data.room) return;
    wx.navigateTo({ url: `/pages/room-table/index?roomId=${this.data.room.id}` });
  }
});
