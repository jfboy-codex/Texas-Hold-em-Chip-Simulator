const { getUser, createRoom } = require('../../utils/store');

Page({
  data: {
    initialChips: 1000,
    smallBlind: 10,
    bigBlind: 20
  },

  onInitialChips(e) { this.setData({ initialChips: Number(e.detail.value || 0) }); },
  onSmallBlind(e) { this.setData({ smallBlind: Number(e.detail.value || 0) }); },
  onBigBlind(e) { this.setData({ bigBlind: Number(e.detail.value || 0) }); },

  onCreateRoom() {
    const owner = getUser();
    if (!owner) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const room = createRoom({
      owner,
      initialChips: this.data.initialChips,
      smallBlind: this.data.smallBlind,
      bigBlind: this.data.bigBlind
    });

    wx.redirectTo({ url: `/pages/room/index?roomId=${room.id}` });
  }
});
