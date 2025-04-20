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
  console.log('User connected:', socket.id);

  socket.on('joinRoom', () => {
    if (waitingUser) {
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

  socket.on('signal', data => {
    if (socket.partner) {
      socket.partner.emit('signal', data);
    }
  });

  socket.on('nextUser', () => {
    if (socket.partner) {
      socket.partner.emit('partnerDisconnected');
      socket.partner.partner = null;
    }
    socket.partner = null;
    socket.emit('waiting');
    if (waitingUser && waitingUser !== socket) {
      const partner = waitingUser;
      waitingUser = null;

      socket.partner = partner;
      partner.partner = socket;

      socket.emit('matched', { partnerId: partner.id });
      partner.emit('matched', { partnerId: socket.id });
    } else {
      waitingUser = socket;
    }
  });

  socket.on('disconnect', () => {
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
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
