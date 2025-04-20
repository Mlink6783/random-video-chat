const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingUser = null;

io.on('connection', socket => {
  console.log('✅ New user connected:', socket.id);

  if (waitingUser && waitingUser.connected) {
    const partner = waitingUser;
    waitingUser = null;

    socket.partner = partner;
    partner.partner = socket;

    console.log(`🔗 Paired: ${socket.id} <--> ${partner.id}`);

    socket.emit('matched', { partnerId: partner.id });
    partner.emit('matched', { partnerId: socket.id });
  } else {
    waitingUser = socket;
    socket.emit('waiting');
    console.log(`⏳ User ${socket.id} is waiting for a partner`);
  }

  socket.on('signal', data => {
    if (socket.partner) {
      console.log(`🔁 Relaying signal from ${socket.id} to ${socket.partner.id}`, data.type || '');
      socket.partner.emit('signal', data);
    }
  });

  socket.on('nextUser', () => {
    console.log(`🔄 ${socket.id} clicked 'Next'`);

    if (socket.partner) {
      socket.partner.emit('partnerDisconnected');
      socket.partner.partner = null;
    }

    socket.partner = null;

    if (waitingUser === socket) {
      waitingUser = null;
    }

    if (waitingUser && waitingUser.connected) {
      const partner = waitingUser;
      waitingUser = null;

      socket.partner = partner;
      partner.partner = socket;

      socket.emit('matched', { partnerId: partner.id });
      partner.emit('matched', { partnerId: socket.id });
    } else {
      waitingUser = socket;
      socket.emit('waiting');
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);

    if (socket.partner) {
      socket.partner.emit('partnerDisconnected');
      socket.partner.partner = null;
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
