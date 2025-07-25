const WebSocket = require('ws');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // важно для Render, если нужно
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

server.on('connection', (socket) => {
  console.log('🔌 New client connected');

  // При подключении отправим все прошлые сообщения из базы
  (async () => {
    const res = await pool.query('SELECT username, message, created_at FROM messages ORDER BY created_at ASC');
    res.rows.forEach(row => {
      socket.send(`${row.username}: ${row.message}`);
    });
  })();

  socket.on('message', async (msg) => {
    console.log('📨 Received:', msg);

    // Сохраняем сообщение в базу
    const [username, ...messageParts] = msg.split(': ');
    const message = messageParts.join(': ');

    await pool.query(
      'INSERT INTO messages (username, message) VALUES ($1, $2)',
      [username, message]
    );

    // Рассылаем всем клиентам, кроме отправителя
    server.clients.forEach(client => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  });

  socket.on('close', () => {
    console.log('❌ Client disconnected');
  });
});
