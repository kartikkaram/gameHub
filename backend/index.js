/**
 * @fileoverview Main server entry point for the real-time multiplayer game application.
 * This file initializes the Express server, configures Socket.IO for WebSocket communication,
 * and manages all real-time events related to lobbies, chat, game sessions, and gameplay.
 */

// --- Module Imports ---
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// --- Game Logic and Handler Imports ---
const { Game: UnoGame } = require('./games/UNO/unoLogic.js');
// Import the entire module to access both the handler and helper functions
const ticTacToeModule = require('./socket-handlers/ticTacToe');

// --- Server Setup ---
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your frontend URL
    methods: ["GET", "POST"]
  }
});

// =================================================================
// --- Centralized In-Memory State Management ---
// =================================================================

const roomParticipants = {};
const socketToRoom = {};
const activeGames = {};
const gameSessions = {};


// =================================================================
// --- Main Socket.IO Connection Handler ---
// =================================================================
io.on('connection', (socket) => {
  console.log(`✅ User Connected: ${socket.id}`);

  // ----------------------------------------
  // Lobby, Room, and Chat Management
  // ----------------------------------------

  /**
   * @event join_room - Handles a user joining a specific room.
   */
  socket.on('join_room', (data) => {
    const { username, roomId } = data;
    socket.join(roomId);
    
    socketToRoom[socket.id] = roomId; 
    if (!roomParticipants[roomId]) {
      roomParticipants[roomId] = [];
    }
    
    if (!roomParticipants[roomId].find(user => user.id === socket.id)) {
      roomParticipants[roomId].push({ id: socket.id, username });
    }

    console.log(`🙋‍♂️ User '${username}' (${socket.id}) joined room: ${roomId}`);
    // Notify others in the room
    socket.to(roomId).emit('user_joined', { username });
    // Send updated list to everyone
    io.to(roomId).emit('update_participant_list', roomParticipants[roomId]);
  });
  
  /**
   * @event send_message - Handles a user sending a chat message to their room.
   * ✅ THIS IS THE RESTORED CHAT HANDLER
   */
  socket.on('send_message', (data) => {
    const roomId = socketToRoom[socket.id];
    // Only broadcast if the user is in a valid room
    if (roomId) {
      // Emit to everyone else in the room (the sender already added it to their own list)
      socket.to(roomId).emit('receive_message', data);
    }
  });

  // ----------------------------------------
  // Invitation and Pre-Game Session Logic
  // ----------------------------------------

  /**
   * @event create_session - Host creates a session and invites specific players.
   */
  socket.on('create_session', ({ gameId, invitedPlayerIds }) => {
    const roomId = socketToRoom[socket.id];
    if (!roomId) return;

    const hostInfo = roomParticipants[roomId]?.[0];
    if (!hostInfo || hostInfo.id !== socket.id) {
      return socket.emit('error', { message: 'Only the host can create a session.' });
    }
    if (activeGames[roomId] || gameSessions[roomId]) {
      return socket.emit('error', { message: 'A game or session is already active.' });
    }

    gameSessions[roomId] = {
      gameId: gameId,
      host: hostInfo,
      players: [hostInfo], // Session starts with only the host
      invited: invitedPlayerIds || [],
    };

    console.log(`[Session] Host ${hostInfo.username} created a ${gameId} session.`);

    // Inform ONLY THE HOST that their session was created.
    socket.emit('session_updated', gameSessions[roomId]);

    // Send a private invitation to EACH invited player.
    if (invitedPlayerIds) {
      invitedPlayerIds.forEach(playerId => {
        io.to(playerId).emit('game_invitation', {
          gameId: gameId,
          host: hostInfo
        });
      });
    }
  });

  /**
   * @event accept_invite - An invited player accepts and joins the session.
   */
  socket.on('accept_invite', () => {
    const roomId = socketToRoom[socket.id];
    const session = gameSessions[roomId];
    if (!session) return;

    const playerInfo = roomParticipants[roomId].find(p => p.id === socket.id);
    if (!playerInfo) return;

    if (!session.players.some(p => p.id === playerInfo.id)) {
      session.players.push(playerInfo);
      console.log(`[Session] ${playerInfo.username} accepted invite for ${session.gameId}.`);

      // Broadcast the updated session state to ALL players currently in the session.
      session.players.forEach(p => {
        io.to(p.id).emit('session_updated', session);
      });
    }
  });
  
  /**
   * @event leave_session - A user leaves the current pre-game session.
   */
  socket.on('leave_session', () => {
    const roomId = socketToRoom[socket.id];
    const session = gameSessions[roomId];
    if (!session) return;
    
    // If the host leaves, the entire session is cancelled.
    if (session.host.id === socket.id) {
      const allSessionPlayers = [...session.players];
      console.log(`[Session] Host left, cancelling session in room ${roomId}.`);
      delete gameSessions[roomId];
      // Notify everyone who was in the session that it has ended.
      allSessionPlayers.forEach(p => {
        io.to(p.id).emit('session_ended', { message: 'The host cancelled the game session.' });
      });
    } else {
      // If a regular player leaves, remove them and notify others in the session.
      session.players = session.players.filter(p => p.id !== socket.id);
      socket.emit('session_ended'); // Tell the leaver to close their session view
      session.players.forEach(p => { // Tell everyone else
        io.to(p.id).emit('session_updated', session);
      });
    }
  });


  // ----------------------------------------
  // Game Lifecycle Management
  // ----------------------------------------

  /**
   * @event start_game - Host starts the game for players in the session.
   */
  socket.on('start_game', () => {
    const roomId = socketToRoom[socket.id];
    const session = gameSessions[roomId];
    
    if (!session || session.host.id !== socket.id) {
      return socket.emit('error', { message: 'You are not the host or no session is active.' });
    }
    
    const { gameId, players } = session;

    if (gameId === 'tic-tac-toe' && players.length !== 2) {
      return socket.emit('error', { message: 'Tic-Tac-Toe requires exactly 2 players.' });
    }
    if (gameId === 'uno' && (players.length < 2 || players.length > 10)) {
      return socket.emit('error', { message: `UNO requires 2-10 players, but you have ${players.length}.` });
    }
    if (activeGames[roomId]) {
      return socket.emit('error', { message: 'A game is already in progress in this room.' });
    }

    console.log(`[Game Start] Starting ${gameId} in room ${roomId} with ${players.length} players.`);

    if (gameId === 'uno') {
      const gameInstance = new UnoGame(players, roomId, io);
      activeGames[roomId] = gameInstance;
      gameInstance.startGame();
    } else if (gameId === 'tic-tac-toe') {
      const gameInstance = ticTacToeModule.createGameState(players);
      activeGames[roomId] = gameInstance;
      io.to(roomId).emit('tictactoe:gameState', gameInstance);
    }

    delete gameSessions[roomId];
    // Notify all players in the room to close the session UI.
    // The game start logic will handle navigation.
    io.to(roomId).emit('session_ended'); 
  });
  
  /**
   * @event end_game - A user manually ends an active game (e.g., by returning to the lobby).
   */
  socket.on('end_game', () => {
    const roomId = socketToRoom[socket.id];
    if (roomId && activeGames[roomId]) {
      console.log(`[Game End] Game in room ${roomId} ended by user request.`);
      delete activeGames[roomId];
      io.to(roomId).emit('game_ended', { message: 'A player has returned to the lobby, ending the game.' });
    }
  });


  // ----------------------------------------
  // In-Game Action Handlers
  // ----------------------------------------
  
  socket.on('uno:getGameState', () => {
    const roomId = socketToRoom[socket.id];
    if (activeGames[roomId] && activeGames[roomId].broadcastGameState) {
      activeGames[roomId].broadcastGameState();
    }
  });
  
  socket.on('uno:playCard', (data) => {
    const roomId = socketToRoom[socket.id];
    if (activeGames[roomId] && activeGames[roomId].playCard) {
      activeGames[roomId].playCard(socket.id, data.card, data.chosenColor);
    }
  });

  socket.on('uno:drawCard', () => {
    const roomId = socketToRoom[socket.id];
    if (activeGames[roomId] && activeGames[roomId].drawCard) {
      activeGames[roomId].drawCard(socket.id);
    }
  });

  socket.on('uno:declareUno', () => {
    const roomId = socketToRoom[socket.id];
    if (activeGames[roomId] && activeGames[roomId].declareUno) {
      activeGames[roomId].declareUno(socket.id);
    }
  });
  
  // Register all Tic-Tac-Toe specific game handlers
  ticTacToeModule.registerTicTacToe(io, socket, { roomParticipants, socketToRoom, activeGames });


  // ----------------------------------------
  // Disconnection Handling
  // ----------------------------------------

  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.id}`);
    const roomId = socketToRoom[socket.id];
    if (!roomId) return;

    let leavingUser = null;
    if (roomParticipants[roomId]) {
      leavingUser = roomParticipants[roomId].find(user => user.id === socket.id);
      roomParticipants[roomId] = roomParticipants[roomId].filter(user => user.id !== socket.id);
      if (leavingUser) {
        socket.to(roomId).emit('user_left', { username: leavingUser.username });
      }
      io.to(roomId).emit('update_participant_list', roomParticipants[roomId]);
    }

    // Clean up from pre-game session
    const session = gameSessions[roomId];
    if (session) {
      if (session.host.id === socket.id) {
        // Host disconnected, kill the session
        delete gameSessions[roomId];
        io.to(roomId).emit('session_ended', { message: 'The host disconnected, cancelling the game.' });
      } else {
        // A player disconnected, just remove them from the list and update
        session.players = session.players.filter(p => p.id !== socket.id);
        session.players.forEach(p => {
          io.to(p.id).emit('session_updated', session);
        });
      }
    }

    // Clean up from active game
    const game = activeGames[roomId];
    if (game && game.players.find(p => p.id === socket.id)) {
      console.log(`[Game ${roomId}] A player disconnected. Ending the game.`);
      delete activeGames[roomId];
      const username = leavingUser ? leavingUser.username : 'A player';
      io.to(roomId).emit('game_ended', { message: `${username} disconnected. The game has ended.` });
    }
    
    delete socketToRoom[socket.id];
  });
});

// --- Server Initialization ---
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});