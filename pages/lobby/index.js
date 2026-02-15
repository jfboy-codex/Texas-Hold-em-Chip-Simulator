const { getUser } = require('../../utils/store');

Page({
  data: { user: null },

  onShow() {
    const user = getUser();
    if (!user) {
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }
    this.setData({ user });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/room-create/index' });
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/room-join/index' });
  }
});
