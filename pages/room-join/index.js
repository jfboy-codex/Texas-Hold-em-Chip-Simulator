const { getUser, joinRoom } = require('../../utils/store');

Page({
  data: {
    roomCode: '',
    qrText: ''
  },

  onCodeInput(e) { this.setData({ roomCode: (e.detail.value || '').toUpperCase() }); },
  onQrInput(e) { this.setData({ qrText: e.detail.value || '' }); },

  doJoin(roomCode) {
    const user = getUser();
    if (!user) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const room = joinRoom(roomCode, user);
    if (!room) {
      wx.showToast({ title: '房间不存在', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/room-table/index?roomId=${room.id}` });
  },

  onJoin() { this.doJoin(this.data.roomCode); },

  onJoinByQr() {
    const match = this.data.qrText.match(/room=([A-Z0-9]+)/i);
    if (!match) {
      wx.showToast({ title: '二维码内容无效', icon: 'none' });
      return;
    }
    this.doJoin(match[1].toUpperCase());
  }
});
