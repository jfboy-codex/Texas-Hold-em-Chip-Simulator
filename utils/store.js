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

function createRoom({ owner, initialChips, smallBlind, bigBlind, orderedPlayers }) {
  const rooms = loadRooms();
  let code = generateRoomCode();
  while (rooms[code]) code = generateRoomCode();

  const players = orderedPlayers.map((player, idx) => ({
    ...player,
    seat: idx + 1,
    chips: initialChips,
    invested: 0,
    folded: false,
    allIn: false
  }));

  const room = {
    id: code,
    ownerId: owner.id,
    initialChips,
    smallBlind,
    bigBlind,
    players,
    pot: 0,
    currentTurn: 0,
    stage: 'preflop',
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
    room.players.push({
      ...user,
      seat: room.players.length + 1,
      chips: room.initialChips,
      invested: 0,
      folded: false,
      allIn: false
    });
    saveRoom(room);
  }

  return room;
}

module.exports = {
  createUser,
  getUser,
  createRoom,
  getRoom,
  saveRoom,
  joinRoom
};
