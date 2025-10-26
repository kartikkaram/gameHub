
module.exports = function registerTicTacToe(io) {
  const games = new Map(); // roomId -> gameState

  function createGameState() {
    return {
      board: Array(9).fill(null),
      players: { X: null, O: null }, // socket.id
      turn: 'X',
      status: 'waiting', // 'waiting' | 'playing' | 'ended'
      winner: null,      // 'X' | 'O' | 'draw' | null
      winningLine: null,
      rematchRequests: new Set(),
    };
  }

  function checkWinner(board) {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (const line of lines) {
      const [a,b,c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line };
      }
    }
    if (board.every(cell => cell !== null)) return { winner: 'draw', line: null };
    return { winner: null, line: null };
  }

  function sanitizeGame(game) {
    return {
      board: game.board.slice(),
      players: {
        X: game.players.X ? 'taken' : null,
        O: game.players.O ? 'taken' : null,
      },
      turn: game.turn,
      status: game.status,
      winner: game.winner,
      winningLine: game.winningLine,
      rematchCount: game.rematchRequests.size,
    };
  }

  io.on('connection', (socket) => {
    // join a room + mark player slot
    socket.on('join-game', ({ roomId }) => {
      if (!roomId) return socket.emit('game-error', { msg: 'roomId required' });

      socket.join(roomId);

      let game = games.get(roomId);
      if (!game) {
        game = createGameState();
        games.set(roomId, game);
      }

      // if socket already assigned, send state
      if (game.players.X === socket.id || game.players.O === socket.id) {
        socket.emit('player-assigned', { mark: game.players.X === socket.id ? 'X' : 'O' });
        socket.emit('game-state', sanitizeGame(game));
        return;
      }

      // assign X/O or spectator
      if (!game.players.X) {
        game.players.X = socket.id;
        socket.emit('player-assigned', { mark: 'X' });
      } else if (!game.players.O) {
        game.players.O = socket.id;
        socket.emit('player-assigned', { mark: 'O' });
      } else {
        socket.emit('player-assigned', { mark: 'spectator' });
      }

      // start when both players present
      if (game.players.X && game.players.O && game.status !== 'playing') {
        game.status = 'playing';
        game.turn = 'X';
        game.winner = null;
        game.winningLine = null;
        game.rematchRequests.clear();
      }

      io.to(roomId).emit('game-state', sanitizeGame(game));
    });

    socket.on('make-move', ({ roomId, index }) => {
      const game = games.get(roomId);
      if (!game) return socket.emit('game-error', { msg: 'Game not found' });
      if (game.status !== 'playing') return socket.emit('game-error', { msg: 'Game not in playing state' });

      const playerMark = game.players.X === socket.id ? 'X' : (game.players.O === socket.id ? 'O' : null);
      if (!playerMark) return socket.emit('game-error', { msg: 'Spectators cannot move' });
      if (playerMark !== game.turn) return socket.emit('game-error', { msg: 'Not your turn' });
      if (typeof index !== 'number' || index < 0 || index > 8 || game.board[index] !== null) {
        return socket.emit('game-error', { msg: 'Invalid move' });
      }

      game.board[index] = playerMark;
      const { winner, line } = checkWinner(game.board);
      if (winner) {
        game.status = 'ended';
        game.winner = winner;
        game.winningLine = line;
        io.to(roomId).emit('game-state', sanitizeGame(game));
        io.to(roomId).emit('game-ended', { winner, winningLine: line });
        return;
      }

      game.turn = game.turn === 'X' ? 'O' : 'X';
      io.to(roomId).emit('game-state', sanitizeGame(game));
    });

    socket.on('request-restart', ({ roomId }) => {
      const game = games.get(roomId);
      if (!game) return;
      game.rematchRequests.add(socket.id);

      if (game.players.X && game.players.O &&
          game.rematchRequests.has(game.players.X) &&
          game.rematchRequests.has(game.players.O)) {
        const nextStarter = game.turn === 'X' ? 'O' : 'X';
        game.board = Array(9).fill(null);
        game.status = 'playing';
        game.winner = null;
        game.winningLine = null;
        game.rematchRequests.clear();
        game.turn = nextStarter;
        io.to(roomId).emit('game-state', sanitizeGame(game));
      } else {
        io.to(roomId).emit('game-state', sanitizeGame(game));
      }
    });

    socket.on('leave-game', ({ roomId }) => {
      const game = games.get(roomId);
      if (!game) return;
      if (game.players.X === socket.id) game.players.X = null;
      if (game.players.O === socket.id) game.players.O = null;
      game.status = 'waiting';
      game.rematchRequests.delete(socket.id);

      if (!game.players.X && !game.players.O) games.delete(roomId);
      else io.to(roomId).emit('game-state', sanitizeGame(game));

      socket.leave(roomId);
    });

    socket.on('request-sync', ({ roomId }) => {
      const game = games.get(roomId);
      if (game) socket.emit('game-state', sanitizeGame(game));
    });

    socket.on('disconnect', () => {
      // clean up: remove socket from any games where present
      for (const [roomId, game] of games.entries()) {
        let changed = false;
        if (game.players.X === socket.id) { game.players.X = null; changed = true; }
        if (game.players.O === socket.id) { game.players.O = null; changed = true; }
        if (changed) {
          game.status = 'waiting';
          game.rematchRequests.delete(socket.id);
          if (!game.players.X && !game.players.O) games.delete(roomId);
          else io.to(roomId).emit('game-state', sanitizeGame(game));
        }
      }
    });
  });
};
