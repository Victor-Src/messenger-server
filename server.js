const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log(`✅ WebSocket server is running on port ${PORT}`);

const clients = new Map(); // username → socket

server.on('connection', (socket) => {
  console.log('🔌 New client connected');

  socket.on('message', (data) => {
    let payload;
    try {
      payload = JSON.parse(data);
    } catch (e) {
      socket.send('❌ Неверный формат сообщения');
      return;
    }

    const { from, to, message } = payload;

    if (!from || !to || !message) {
      socket.send('❌ Все поля обязательны');
      return;
    }

    // Сохраняем клиента
    clients.set(from, socket);

    const recipientSocket = clients.get(to);
    if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
      recipientSocket.send(`${from} → вы: ${message}`);
    } else {
      socket.send(`⚠️ Пользователь "${to}" не в сети`);
    }
  });

  socket.on('close', () => {
    console.log('❌ Client disconnected');
    // Удалим клиента, если его socket совпадает
    for (const [name, sock] of clients.entries()) {
      if (sock === socket) {
        clients.delete(name);
        break;
      }
    }
  });
});
