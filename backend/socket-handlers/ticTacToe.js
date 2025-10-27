/**
 * Tic Tac Toe Game Logic Handler
 * This function attaches all Tic Tac Toe related event listeners to a socket.
 * * @param {object} io - The main Socket.IO server instance.
 * @param {object} socket - The individual socket instance for a connected user.
 * @param {object} state - A reference to the shared server state.
 * @param {object} state.roomParticipants - { roomId: [ { id, username }, ... ] }
 * @param {object} state.socketToRoom - { socketId: roomId }
 * @param {object} state.activeGames - { roomId: gameInstance }
 */

const createGameState = (players) => {
  return {
    gameType: 'TicTacToe',
    board: Array(9).fill(null),
    players: [
      { id: players[0].id, username: players[0].username, mark: 'X' },
      { id: players[1].id, username: players[1].username, mark: 'O' }
    ],
    turn: 'X',
    status: 'playing',
    winner: null,
    winningLine: null,
    rematchRequests: new Set(),
  };
};


function registerTicTacToe(io, socket, state) {

  // --- Helper Functions (specific to Tic Tac Toe) ---

  const checkWinner = (board) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
    for (const line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line };
      }
    }
    if (board.every(cell => cell !== null)) return { winner: 'draw', line: null };
    return { winner: null, line: null };
  };

  // --- Socket Event Listeners ---

  /**
   * Host starts the Tic Tac Toe game for the room.
   */
  socket.on('tictactoe:start', () => {
    const roomId = state.socketToRoom[socket.id];
    if (!roomId) return;
    
    // Use shared state to get participants and check rules
    const participants = state.roomParticipants[roomId];

    if (state.activeGames[roomId]) {
      return socket.emit('error', { message: 'A game is already in progress.' });
    }
    if (!participants || participants[0].id !== socket.id) {
      return socket.emit('error', { message: 'Only the room host can start the game.' });
    }
    if (participants.length !== 2) {
      return socket.emit('error', { message: 'Tic Tac Toe requires exactly 2 players.' });
    }
    
    console.log(`[Server] Starting Tic Tac Toe game in room ${roomId}`);
    const game = createGameState(participants);
    state.activeGames[roomId] = game; // CHANGED: Use the shared activeGames object

    io.to(roomId).emit('tictactoe:gameState', game);
  });

  /**
   A player's client has loaded and is requesting the current game state.
   */
  socket.on('tictactoe:requestState', () => {
    const roomId = state.socketToRoom[socket.id];
    if (!roomId) return;

    const game = state.activeGames[roomId];

    // If a TicTacToe game exists for this room, send its state to the requesting player.
    if (game && game.gameType === 'TicTacToe') {
      socket.emit('tictactoe:gameState', game);
    }
  });

  /**
   * Player makes a move.
   */
  socket.on('tictactoe:makeMove', ({ index }) => {
    const roomId = state.socketToRoom[socket.id];
    const game = state.activeGames[roomId];

    // Basic validations
    if (!game || game.gameType !== 'TicTacToe') return;
    if (game.status !== 'playing') return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return; // Spectator check
    if (player.mark !== game.turn) return socket.emit('error', { message: 'Not your turn.' });
    if (typeof index !== 'number' || index < 0 || index > 8 || game.board[index] !== null) {
      return socket.emit('error', { message: 'Invalid move.' });
    }

    // Apply move and check for winner
    game.board[index] = player.mark;
    const { winner, line } = checkWinner(game.board);
    
    if (winner) {
      game.status = 'ended';
      game.winner = winner;
      game.winningLine = line;
      // Use the generic 'game_ended' event for the client to handle
      io.to(roomId).emit('game_ended', { winner, winningLine: line });
    } else {
      game.turn = game.turn === 'X' ? 'O' : 'X';
    }

    io.to(roomId).emit('tictactoe:gameState', game);
  });
  
  /**
   * A player requests a rematch.
   */
  socket.on('tictactoe:requestRematch', () => {
    const roomId = state.socketToRoom[socket.id];
    const game = state.activeGames[roomId];
    if (!game || game.gameType !== 'TicTacToe' || game.status !== 'ended') return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return; // Only players can request a rematch

    game.rematchRequests.add(socket.id);

    // If both players have requested a rematch, reset the game
    if (game.rematchRequests.size === 2) {
      console.log(`[Server] Rematching Tic Tac Toe in room ${roomId}`);
      const newGame = createGameState(game.players.reverse()); // Swap who starts
      state.activeGames[roomId] = newGame;
      io.to(roomId).emit('tictactoe:gameState', newGame);
    } else {
      // Notify others that one player wants a rematch
      io.to(roomId).emit('tictactoe:rematchRequested', { userId: socket.id });
    }
  });
};


module.exports = { registerTicTacToe, createGameState };