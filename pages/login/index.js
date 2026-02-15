const { createUser, getUser } = require('../../utils/store');

Page({
  data: { user: null },

  onShow() {
    this.setData({ user: getUser() });
  },

  onWxLogin() {
    wx.getUserProfile({
      desc: '用于展示头像昵称',
      success: (res) => {
        const user = createUser(res.userInfo);
        getApp().globalData.currentUser = user;
        this.setData({ user });
      }
    });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/room-create/index' });
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/room-join/index' });
  }
});
