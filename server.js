const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingUsers = [];
const pairs = new Map();

io.on('connection', (socket) => {
  console.log('✅ New user connected:', socket.id);

  // Match or wait
  if (waitingUsers.length > 0) {
    const partner = waitingUsers.shift();

    // Pair both users
    pairs.set(socket.id, partner.id);
    pairs.set(partner.id, socket.id);

    socket.emit('matched', { partnerId: partner.id });
    partner.emit('matched', { partnerId: socket.id });

    console.log(`🔗 Paired: ${socket.id} <--> ${partner.id}`);
  } else {
    waitingUsers.push(socket);
    socket.emit('waiting');
    console.log(`⏳ User ${socket.id} is waiting for a partner`);
  }

  // Handle signaling data
  socket.on('signal', (data) => {
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('signal', data);
        console.log(`🔁 Relaying signal from ${socket.id} to ${partnerId}`);
      }
    }
  });

  // Handle next button
  socket.on('nextUser', () => {
    console.log(`🔄 ${socket.id} clicked 'Next'`);
    disconnectPartner(socket);
    waitingUsers.push(socket);
    socket.emit('waiting');
  });

  // On disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    disconnectPartner(socket);
    waitingUsers = waitingUsers.filter((s) => s.id !== socket.id);
  });

  function disconnectPartner(socket) {
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partnerDisconnected');
        pairs.delete(partnerId);
      }
      pairs.delete(socket.id);
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
