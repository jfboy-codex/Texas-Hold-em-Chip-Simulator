const USER_KEY = 'ths_user';
const ROOMS_KEY = 'ths_rooms';

function loadRooms() {
  return wx.getStorageSync(ROOMS_KEY) || {};
}

function saveRooms(rooms) {
  wx.setStorageSync(ROOMS_KEY, rooms);
}

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createUser(profile) {
  const user = {
    id: `u_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    nickName: profile.nickName,
    avatarUrl: profile.avatarUrl,
    createdAt: Date.now()
  };
  wx.setStorageSync(USER_KEY, user);
  return user;
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function updateUserNickName(nickName) {
  const user = getUser();
  if (!user) return null;
  const next = { ...user, nickName };
  wx.setStorageSync(USER_KEY, next);
  return next;
}

function createRoom({ owner, initialChips, smallBlind, bigBlind }) {
  const rooms = loadRooms();
  let code = generateRoomCode();
  while (rooms[code]) code = generateRoomCode();

  const players = [{
    ...owner,
    seat: 1,
    chips: initialChips,
    invested: 0,
    folded: false,
    allIn: false,
    ready: false
  }];

  const room = {
    id: code,
    ownerId: owner.id,
    initialChips,
    smallBlind,
    bigBlind,
    maxSeats: 8,
    players,
    pot: 0,
    currentTurn: 0,
    stage: 'preflop',
    status: 'waiting',
    actions: [],
    createdAt: Date.now()
  };

  rooms[code] = room;
  saveRooms(rooms);
  return room;
}

function getRoom(roomId) {
  return loadRooms()[roomId] || null;
}

function saveRoom(room) {
  const rooms = loadRooms();
  rooms[room.id] = room;
  saveRooms(rooms);
}

function joinRoom(roomId, user) {
  const room = getRoom(roomId);
  if (!room) return null;

  const exists = room.players.find((p) => p.id === user.id);
  if (!exists) {
    if (room.players.length >= room.maxSeats) return { error: 'FULL' };
    room.players.push({
      ...user,
      seat: room.players.length + 1,
      chips: room.initialChips,
      invested: 0,
      folded: false,
      allIn: false,
      ready: false
    });
    saveRoom(room);
  }

  return room;
}

function updatePlayerInRoom(roomId, userId, patch) {
  const room = getRoom(roomId);
  if (!room) return null;
  room.players = room.players.map((p) => (p.id === userId ? { ...p, ...patch } : p));
  saveRoom(room);
  return room;
}

function areAllPlayersReady(room) {
  return room.players.length > 1 && room.players.every((p) => p.ready);
}

module.exports = {
  createUser,
  getUser,
  updateUserNickName,
  createRoom,
  getRoom,
  saveRoom,
  joinRoom,
  updatePlayerInRoom,
  areAllPlayersReady
};
