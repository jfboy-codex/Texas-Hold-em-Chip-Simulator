const { createUser, getUser } = require('../../utils/store');

Page({
  data: { user: null },

  onShow() {
    const user = getUser();
    this.setData({ user });
    if (user) {
      wx.reLaunch({ url: '/pages/lobby/index' });
    }
  },

  onWxLogin() {
    wx.getUserProfile({
      desc: '用于展示头像昵称',
      success: (res) => {
        const user = createUser(res.userInfo);
        getApp().globalData.currentUser = user;
        this.setData({ user });
        wx.reLaunch({ url: '/pages/lobby/index' });
      }
    });
  },

  goLobby() {
    wx.reLaunch({ url: '/pages/lobby/index' });
  }
});
