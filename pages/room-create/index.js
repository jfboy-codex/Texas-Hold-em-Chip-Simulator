const { getUser, createRoom } = require('../../utils/store');

Page({
  data: {
    chip10: 30,
    chip20: 10,
    chip50: 10,
    smallBlind: 10,
    bigBlind: 20
  },

  onChip10Input(e) { this.setData({ chip10: Number(e.detail.value || 0) }); },
  onChip20Input(e) { this.setData({ chip20: Number(e.detail.value || 0) }); },
  onChip50Input(e) { this.setData({ chip50: Number(e.detail.value || 0) }); },
  onSmallBlind(e) { this.setData({ smallBlind: Number(e.detail.value || 0) }); },
  onBigBlind(e) { this.setData({ bigBlind: Number(e.detail.value || 0) }); },

  onCreateRoom() {
    const owner = getUser();
    if (!owner) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const chipConfig = {
      chip10: this.data.chip10,
      chip20: this.data.chip20,
      chip50: this.data.chip50
    };

    const room = createRoom({
      owner,
      chipConfig,
      smallBlind: this.data.smallBlind,
      bigBlind: this.data.bigBlind
    });

    wx.redirectTo({ url: `/pages/room/index?roomId=${room.id}` });
  }
});
