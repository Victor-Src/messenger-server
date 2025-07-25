const WebSocket = require('ws');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // важно для Render
  }
});

const server = new WebSocket.Server({ port: PORT });
console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);

// Инициализация таблицы сообщений
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

let onlineUsers = new Set();

function broadcastOnlineUsers() {
  const users = Array.from(onlineUsers);
  const data = JSON.stringify({ type: 'online-users', users });
  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

server.on('connection', (socket) => {
  console.log('🔌 New client connected');

  // При подключении отправим все прошлые сообщения
  (async () => {
    const res = await pool.query('SELECT username, message, created_at FROM messages ORDER BY created_at ASC');
    for (const row of res.rows) {
      socket.send(JSON.stringify({
        type: 'message',
        from: row.username,
        message: row.message,
        createdAt: row.created_at
      }));
    }
  })();

  let currentUser = null;

  socket.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'register') {
        currentUser = data.from;
        onlineUsers.add(currentUser);
        broadcastOnlineUsers();
        console.log(`👤 User registered: ${currentUser}`);
        return;
      }

      if (data.type === 'message') {
        const { from, to, message } = data;

        // Сохраняем в базу
        await pool.query(
          'INSERT INTO messages (username, message) VALUES ($1, $2)',
          [from, message]
        );

        // Рассылаем всем клиентам, кроме отправителя
        const outgoing = JSON.stringify({
          type: 'message',
          from,
          to,
          message
        });

        server.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(outgoing);
          }
        });
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  socket.on('close', () => {
    if (currentUser) {
      onlineUsers.delete(currentUser);
      broadcastOnlineUsers();
      console.log(`❌ Client disconnected: ${currentUser}`);
    }
  });
});
