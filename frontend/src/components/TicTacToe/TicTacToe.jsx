import React, { useEffect, useState, useMemo } from "react";
import { useSocket } from "../../socketContext"; // adjust path if needed

const clsx = (...classes) => classes.filter(Boolean).join(" ");

export default function TicTacToe() {
  const { socket, roomId, username } = useSocket(); // ✅ REMOVED: isHost and participants are no longer needed here
  const [game, setGame] = useState(null);
  const [resultModal, setResultModal] = useState(null);
  const [rematchRequested, setRematchRequested] = useState(new Set());

  // --- Derived State ---
  const myMark = useMemo(() => {
    if (!game || !socket) return null;
    return game.players.find(p => p.id === socket.id)?.mark || "spectator";
  }, [game, socket]);
  
  // ✅ REMOVED: The isHost memo is no longer necessary.

  // --- ✅ NEW: Initial State Sync ---
  useEffect(() => {
    if (socket && !game) {
      // When the component mounts, ask the server for the current game state.
      socket.emit("tictactoe:requestState");
    }
  }, [socket, game]); // Runs once when the socket is available.

  // --- Socket Listeners ---
  useEffect(() => {
    if (!socket) return;

    const onGameState = (gameState) => {
      setGame(gameState);
      if (gameState.status === 'playing') {
        setResultModal(null);
        setRematchRequested(new Set());
      }
    };
    
    const onGameError = ({ message }) => {
      console.warn("Game Error:", message);
    };

    const onGameEnded = ({ winner }) => {
      if (!game) return;
      if (winner === "draw") {
        setResultModal({ type: "draw", text: "It's a draw!" });
      } else {
        const winnerPlayer = game.players.find(p => p.mark === winner);
        const winnerName = winnerPlayer ? winnerPlayer.username : winner;
        setResultModal({ type: "win", text: `${winnerName} (${winner}) wins!` });
      }
    };

    const onRematchRequested = ({ userId }) => {
      setRematchRequested(prev => new Set(prev).add(userId));
    };

    socket.on("tictactoe:gameState", onGameState);
    socket.on("error", onGameError);
    socket.on("game_ended", onGameEnded);
    socket.on("tictactoe:rematchRequested", onRematchRequested);

    return () => {
      socket.off("tictactoe:gameState", onGameState);
      socket.off("error", onGameError);
      socket.off("game_ended", onGameEnded);
      socket.off("tictactoe:rematchRequested", onRematchRequested);
    };
  }, [socket, game]);

  // --- Client Actions ---
  
  // ✅ REMOVED: The handleStartGame function is gone.

  const canPlayCell = (i) => {
    if (!game || game.status !== "playing" || myMark === "spectator" || game.board[i] !== null || game.turn !== myMark) {
      return false;
    }
    return true;
  };

  const handleCellClick = (i) => {
    if (!roomId || !canPlayCell(i)) return;
    socket.emit("tictactoe:makeMove", { index: i });
  };

  const handleRequestRematch = () => {
    if (!roomId || !socket) return;
    socket.emit("tictactoe:requestRematch");
    setResultModal(null);
  };

  // --- Display Logic ---

  const statusText = useMemo(() => {
    if (!game) return "Loading Game...";
    if (game.status === "playing") return `Turn: ${game.turn}`;
    if (game.status === "ended") {
      return game.winner === "draw" ? "Ended: Draw" : `Ended: ${game.winner} won`;
    }
    return "";
  }, [game]);

  // ✅ CHANGED: Replaced the "Start Game" screen with a simple loading state.
  if (!game) {
    return (
      <div className="text-center p-10">
        <h3 className="text-2xl font-bold text-white mb-4">Loading Tic-Tac-Toe...</h3>
        <p className="text-gray-400">Please wait a moment.</p>
      </div>
    );
  }

  const playerX = game.players.find(p => p.mark === 'X');
  const playerO = game.players.find(p => p.mark === 'O');

  // --- Main Game Render ---
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 items-center bg-gray-900/60 p-2 rounded-xl shadow-md">
          <PlayerBadge 
            mark="X" 
            name={playerX?.username} 
            active={game.turn === "X"} 
            me={playerX?.id === socket?.id} 
          />
          <div className="w-px h-6 bg-gray-700/40" />
          <PlayerBadge 
            mark="O" 
            name={playerO?.username} 
            active={game.turn === "O"} 
            me={playerO?.id === socket?.id} 
          />
        </div>
      </div>

      <div className="mb-3 text-sm text-gray-300">{statusText}</div>

      <div className="relative bg-gray-900/60 p-5 rounded-2xl shadow-xl border border-gray-800">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => {
            const val = game.board[i];
            const winning = game.winningLine && game.winningLine.includes(i);
            const clickable = canPlayCell(i);
            const base = "h-24 md:h-28 flex items-center justify-center text-3xl md:text-4xl font-extrabold rounded-lg transition-all";
            const bgClass = winning ? "bg-emerald-400 scale-105" : val ? "bg-gray-700" : "bg-gray-800";
            const transformClass = clickable ? "hover:bg-gray-700 cursor-pointer" : "cursor-default";
            const markColor = val === "X" ? "text-rose-400" : "text-blue-400";
            return (
              <button
                key={i}
                onClick={() => handleCellClick(i)}
                disabled={!clickable}
                className={clsx(base, bgClass, transformClass)}
                aria-label={`cell-${i}`}
              >
                <span className={clsx(markColor, !val && "opacity-0")}>{val}</span>
              </button>
            );
          })}
        </div>

        {resultModal && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
              <div className="text-xl font-extrabold mb-2 text-white">{resultModal.text}</div>
              <div className="text-sm text-gray-300 mb-6">Good game!</div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleRequestRematch}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  Rematch {rematchRequested.has(socket.id) && `(Requested)`}
                </button>
                <button
                  onClick={() => setResultModal(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ... PlayerBadge component remains the same
function PlayerBadge({ mark, name, active, me }) {
  const bg = mark === "X" ? "bg-rose-600" : "bg-blue-600";
  return (
    <div className="flex items-center space-x-3 p-2">
      <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md", bg)}>
        {mark}
      </div>
      <div className="text-left leading-tight">
        <div className={clsx("text-sm font-semibold", me ? "text-white" : "text-gray-200")}>
          {name || "..."} {me && "(You)"}
        </div>
        <div className={clsx("text-xs", active ? "text-emerald-300 animate-pulse" : "text-gray-400")}>
          {active ? "Playing" : "Waiting"}
        </div>
      </div>
    </div>
  );
}