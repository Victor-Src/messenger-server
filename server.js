const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log(`✅ WebSocket server is running on ws://localhost:${PORT}`);

server.on('connection', (socket) => {
  console.log('🔌 New client connected');

  socket.on('message', (message) => {
    console.log('📨 Received:', message);
    
    // Отправляем сообщение всем клиентам, кроме отправителя
    server.clients.forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  socket.on('close', () => {
    console.log('❌ Client disconnected');
  });
});
