const WebSocket = require('ws');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const server = new WebSocket.Server({ port: PORT });
console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);

const onlineUsers = new Map();

// Создание таблицы при запуске
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50),
      message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
})();

function broadcastToAll(obj) {
  const data = JSON.stringify(obj);
  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

server.on('connection', (socket) => {
  let currentUsername = null;

  console.log('🔌 New client connected');

  // Обработка входящих сообщений
  socket.on('message', async (raw) => {
    let data;

    try {
      data = JSON.parse(raw);
    } catch (err) {
      return;
    }

    if (data.type === 'register') {
      currentUsername = data.from;
      onlineUsers.set(socket, currentUsername);

      // Отправка истории сообщений
      const res = await pool.query(`
        SELECT username, message FROM messages ORDER BY created_at ASC LIMIT 50
      `);
      socket.send(JSON.stringify({
        type: 'history',
        messages: res.rows
      }));

      // Обновить список онлайн
      broadcastToAll({
        type: 'online-users',
        users: Array.from(onlineUsers.values())
      });
    }

    if (data.type === 'message') {
      const { from, to, message } = data;
      const formatted = `${from} → ${to}: ${message}`;

      // Сохраняем в БД
      await pool.query(
        'INSERT INTO messages (username, message) VALUES ($1, $2)',
        [from, formatted]
      );

      // Отправить всем
      broadcastToAll({ type: 'message', text: formatted });
    }
  });

  socket.on('close', () => {
    if (currentUsername) {
      onlineUsers.delete(socket);

      broadcastToAll({
        type: 'online-users',
        users: Array.from(onlineUsers.values())
      });
    }
  });
});
