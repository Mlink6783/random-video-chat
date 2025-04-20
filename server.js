const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

const waitingUsers = new Set();
const userPartners = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", () => {
    // Try to match with someone else in the waiting queue
    let matched = false;

    for (let otherId of waitingUsers) {
      if (otherId !== socket.id) {
        waitingUsers.delete(otherId);

        userPartners.set(socket.id, otherId);
        userPartners.set(otherId, socket.id);

        socket.emit("matched", { partnerId: otherId });
        io.to(otherId).emit("matched", { partnerId: socket.id });

        matched = true;
        break;
      }
    }

    if (!matched) {
      waitingUsers.add(socket.id);
      socket.emit("waiting");
    }
  });

  socket.on("nextUser", () => {
    const partnerId = userPartners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("partnerDisconnected");
      userPartners.delete(partnerId);
      userPartners.delete(socket.id);
    }
    waitingUsers.delete(socket.id);
    socket.emit("joinRoom");
  });

  socket.on("signal", (data) => {
    const partnerId = userPartners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("signal", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const partnerId = userPartners.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("partnerDisconnected");
      userPartners.delete(partnerId);
    }

    userPartners.delete(socket.id);
    waitingUsers.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
