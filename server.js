const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const server = new WebSocket.Server({ port: PORT });

console.log(`✅ WebSocket сервер работает на порту ${PORT}`);

const clients = new Map(); // username -> socket

function broadcastOnlineUsers() {
  const users = Array.from(clients.keys());
  const message = JSON.stringify({
    type: "online-users",
    users,
  });

  clients.forEach((sock) => {
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(message);
    }
  });
}

server.on("connection", (socket) => {
  let currentUser = null;

  socket.on("message", (data) => {
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return socket.send("❌ Неверный формат");
    }

    if (parsed.type === "register") {
      if (!parsed.from) return;
      currentUser = parsed.from;
      clients.set(currentUser, socket);
      broadcastOnlineUsers();
      return;
    }

    if (parsed.type === "message") {
      const { from, to, message } = parsed;
      if (!from || !to || !message) return;

      const toSocket = clients.get(to);
      if (toSocket && toSocket.readyState === WebSocket.OPEN) {
        toSocket.send(`${from} → вы: ${message}`);
      } else {
        socket.send(`⚠️ Пользователь "${to}" не в сети`);
      }
    }
  });

  socket.on("close", () => {
    if (currentUser) {
      clients.delete(currentUser);
      broadcastOnlineUsers();
    }
  });
});
