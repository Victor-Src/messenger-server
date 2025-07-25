const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log(`✅ WebSocket server is running on port ${PORT}`);

const clients = new Map(); // username -> socket

function broadcastOnlineUsers() {
  const userList = Array.from(clients.keys());

  const payload = JSON.stringify({
    type: 'online-users',
    users: userList
  });

  for (const socket of clients.values()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

server.on('connection', (socket) => {
  let currentUsername = null;

  socket.on('message', (data) => {
    let payload;
    try {
      payload = JSON.parse(data);
    } catch (e) {
      socket.send('❌ Invalid message format');
      return;
    }

    const { type, from, to, message } = payload;

    if (type === 'register') {
      if (!from) {
        socket.send('❌ Missing username');
        return;
      }

      currentUsername = from;
      clients.set(from, socket);
      broadcastOnlineUsers();
      return;
    }

    if (type === 'message') {
      if (!from || !to || !message) {
        socket.send('❌ Missing message fields');
        return;
      }

      const recipientSocket = clients.get(to);
      if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
        recipientSocket.send(`${from} → вы: ${message}`);
      } else {
        socket.send(`⚠️ Пользователь "${to}" не в сети`);
      }
    }
  });

  socket.on('close', () => {
    if (currentUsername) {
      clients.delete(currentUsername);
      broadcastOnlineUsers();
    }
  });
});
