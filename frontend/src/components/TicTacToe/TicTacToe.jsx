import React, { useEffect, useState, useMemo } from "react";
import { useSocket } from "../../socketContext"; // adjust path if needed
const clsx = (...classes) => classes.filter(Boolean).join(" ");

export default function TicTacToe() {
  const { socket, roomId, username } = useSocket();
  const [game, setGame] = useState(null);
  const [myMark, setMyMark] = useState(null);
  const [joined, setJoined] = useState(false); // track auto-join
  const [resultModal, setResultModal] = useState(null); // { type: 'win'|'draw', text }

  // --- socket listeners
  useEffect(() => {
    if (!socket) return;

    const onGameState = (s) => setGame(s);
    const onPlayerAssigned = ({ mark }) => setMyMark(mark);
    const onGameError = ({ msg }) => {
      console.warn("game-error:", msg);
    };
    const onGameEnded = ({ winner }) => {
      // show result modal instead of banner/alert
      if (winner === "draw") {
        setResultModal({ type: "draw", text: "It's a draw!" });
      } else {
        setResultModal({ type: "win", text: `${winner} wins!` });
      }
      // Note: keep modal open until user dismisses or requests rematch
    };

    socket.on("game-state", onGameState);
    socket.on("player-assigned", onPlayerAssigned);
    socket.on("game-error", onGameError);
    socket.on("game-ended", onGameEnded);

    return () => {
      socket.off("game-state", onGameState);
      socket.off("player-assigned", onPlayerAssigned);
      socket.off("game-error", onGameError);
      socket.off("game-ended", onGameEnded);
    };
  }, [socket]);

  // --- initial sync
  useEffect(() => {
    if (socket && roomId) socket.emit("request-sync", { roomId });
  }, [socket, roomId]);

  // --- auto-join once username+room available (auto-join on mount)
  useEffect(() => {
    if (!socket || !roomId) return;
    if (joined || myMark) return; // already joined or have mark
    // Use provided username or fallback to anonymous
    socket.emit("join-game", { roomId, username });
    setJoined(true);
  }, [socket, roomId, username, joined, myMark]);

  const canPlayCell = (i) => {
    if (!game) return false;
    if (game.status !== "playing") return false;
    if (!myMark || myMark === "spectator") return false;
    if (game.board[i] !== null) return false;
    if (game.turn !== myMark) return false;
    return true;
  };

  const handleCell = (i) => {
    if (!roomId) return;
    if (!canPlayCell(i)) return;
    socket.emit("make-move", { roomId, index: i });
  };

  const requestRestart = () => {
    if (!roomId) return alert("No roomId set");
    // allow any player (both winner and loser) to request a rematch from the client
    socket.emit("request-restart", { roomId });
    // close modal if it's open
    setResultModal(null);
  };
  const leaveGame = () => {
    if (!roomId) return alert("No roomId set");
    socket.emit("leave-game", { roomId });
    setMyMark(null);
    setJoined(false);
  };

  const statusText = useMemo(() => {
    if (!game) return "No game data";
    if (game.status === "waiting") return "Waiting for players...";
    if (game.status === "playing") return `Turn: ${game.turn}`;
    if (game.status === "ended") {
      if (game.winner === "draw") return "Ended: Draw";
      return `Ended: ${game.winner} won`;
    }
    return "";
  }, [game]);

  // helpers for display
  const playerName = (mark) => (game && game.players && game.players[mark] ? game.players[mark].username : null);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-extrabold text-white tracking-tight">Tic‑Tac‑Toe</h3>
          <div className="text-sm text-gray-400 mt-1">Room: <span className="font-medium text-white">{roomId || "—"}</span></div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex gap-4 items-center bg-gradient-to-r from-gray-800/60 to-gray-900/40 p-2 rounded-xl shadow-md">
            <PlayerBadge mark="X" name={playerName("X")} active={game?.turn === "X"} me={myMark === "X"} />
            <div className="w-px h-6 bg-gray-700/40" />
            <PlayerBadge mark="O" name={playerName("O")} active={game?.turn === "O"} me={myMark === "O"} />
          </div>

          <div className="flex items-center space-x-2">
            {/* Rematch is available to any connected player now */}
            <button
              onClick={requestRestart}
              className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:scale-105 transform transition text-sm shadow-sm"
            >
              Rematch
            </button>
            <button
              onClick={leaveGame}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:scale-105 transform transition text-sm shadow-sm"
            >
              Leave
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 text-sm text-gray-300">{statusText}</div>

      <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 p-5 rounded-2xl shadow-xl border border-gray-800">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => {
            const val = game ? game.board[i] : null; // 'X'|'O'|null
            const winning = game && game.winningLine && game.winningLine.includes(i);
            const clickable = canPlayCell(i);

            // dynamic classes
            const base = "h-24 md:h-28 flex items-center justify-center text-3xl md:text-4xl font-extrabold rounded-lg transition-transform";
            const bgClass = winning ? "bg-emerald-100/90" : val ? "bg-white" : "bg-white/6";
            const transformClass = clickable ? "hover:scale-105 cursor-pointer" : "cursor-default";
            const borderClass = "border border-gray-700";
            // mark color
            const markColor = val === "X" ? "text-rose-600" : val === "O" ? "text-indigo-600" : "text-gray-300";

            return (
              <button
                key={i}
                onClick={() => handleCell(i)}
                disabled={!clickable}
                className={clsx(base, bgClass, borderClass, transformClass)}
                aria-label={`cell-${i}`}
              >
                <span className={clsx(markColor, !val && "opacity-20")}>{val || ""}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-gray-300">
          <div>
            <span className="font-semibold text-gray-100">You:</span>{" "}
            <span>{username || "—"} <span className="text-gray-400">({myMark || "spectator"})</span></span>
          </div>
          <div className="text-right">
            <div className="text-[11px]">Rematch requests: <span className="font-medium text-gray-100">{game?.rematchCount ?? 0}</span></div>
            <div className="text-[11px] mt-1">Players: <span className="font-medium">{game ? Object.values(game.players || {}).filter(Boolean).length : 0}</span></div>
          </div>
        </div>

        {/* Result modal - shown when a game ends */}
        {resultModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white/95 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
              <div className="text-lg font-extrabold mb-2 text-gray-900">{resultModal.text}</div>
              <div className="text-sm text-gray-700 mb-4">Good game — want to play again?</div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={requestRestart}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:scale-105 transition"
                >
                  Rematch
                </button>
                <button
                  onClick={() => setResultModal(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:scale-105 transition"
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

/* small subcomponent */
function PlayerBadge({ mark, name, active, me }) {
  const bg = mark === "X" ? "bg-gradient-to-br from-rose-600 to-rose-500" : "bg-gradient-to-br from-indigo-600 to-indigo-500";
  return (
    <div className="flex items-center space-x-3">
      <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md", bg)}>
        {mark}
      </div>
      <div className="text-left leading-tight">
        <div className={clsx("text-sm font-semibold", me ? "text-white" : "text-gray-200")}>{name || "—"}</div>
        <div className={clsx("text-[11px]", active ? "text-emerald-300" : "text-gray-400")}>{active ? "playing" : "idle"}</div>
      </div>
    </div>
  );
}
