const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const registerTicTacToe = require('./socket-handlers/ticTacToe');

const app = express();
app.use(cors()); // Enable CORS for all routes

const server = http.createServer(app);

// Initialize Socket.IO and attach it to the server
// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// --- NEW: Server-side state to track participants ---
const roomParticipants = {}; // { roomId: [ { id: socket.id, username: "Jatin" }, ... ] }
const socketToRoom = {};     // { socket.id: "roomId" }
// ----------------------------------------------------

// after const io = new Server(...)
registerTicTacToe(io);

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Logic for a user joining a room
  socket.on('join_room', (data) => {
    const { username, roomId } = data;
    socket.join(roomId);
    
    // --- NEW: Add participant to tracking ---
    socketToRoom[socket.id] = roomId; // Map socket ID to room ID

    if (!roomParticipants[roomId]) { // If room doesn't exist, create it
      roomParticipants[roomId] = [];
    }

    // Add new participant (avoiding duplicates)
    if (!roomParticipants[roomId].find(user => user.id === socket.id)) {
      roomParticipants[roomId].push({ id: socket.id, username });
    }
    // ----------------------------------------

    console.log(`🙋‍♂️ User '${username}' (${socket.id}) joined room: ${roomId}`);
    
    // Optional: Notify others in the room that a new user has joined
    socket.to(roomId).emit('user_joined', { username });

    // --- NEW: Send the updated participant list to EVERYONE in the room ---
    io.to(roomId).emit('update_participant_list', roomParticipants[roomId]);
    // ----------------------------------------------------------------------
  });

  // Logic for receiving and broadcasting a message
  socket.on('send_message', (data) => {
    // Emit the received message to all clients in that specific room
    socket.to(data.roomId).emit('receive_message', data);
    console.log(`💬 Message sent in room ${data.roomId}: "${data.message}" by ${data.author}`);
  });

  // Logic for when a user disconnects
  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    
    // --- NEW: Handle participant list on disconnect ---
    const roomId = socketToRoom[socket.id]; // Find which room the socket was in

    if (roomId && roomParticipants[roomId]) {
      // Find the user who is leaving
      const leavingUser = roomParticipants[roomId].find(user => user.id === socket.id);

      // Remove the user from the room's participant list
      roomParticipants[roomId] = roomParticipants[roomId].filter(
        (user) => user.id !== socket.id
      );

      // Notify the room that the user has left
      if (leavingUser) {
        socket.to(roomId).emit('user_left', { username: leavingUser.username });
      }

      // Send the updated (smaller) participant list to everyone
      io.to(roomId).emit('update_participant_list', roomParticipants[roomId]);

      // Optional: Clean up the room if it's empty
      if (roomParticipants[roomId].length === 0) {
        delete roomParticipants[roomId];
      }
    }
    
    // Clean up the socket-to-room mapping
    delete socketToRoom[socket.id];
    // ------------------------------------------------
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
