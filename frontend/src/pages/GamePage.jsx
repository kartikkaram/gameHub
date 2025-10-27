import React from 'react';
// ✅ Import useNavigate
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
// ✅ Import useSocket
import { useSocket } from '../socketContext'; 

// Import all your game components
import UnoGame from '../components/Uno/UnoGame';
import TicTacToe from '../components/TicTacToe/TicTacToe';

function GamePage() {
  const { roomId, gameId } = useParams();
  // ✅ Get socket and username from context
  const { socket, username } = useSocket();
  // ✅ Get the navigate function
  const navigate = useNavigate();

  const games = {
    'tic-tac-toe': <TicTacToe />,
    'uno': <UnoGame />,
  };

  const CurrentGame = games[gameId] || <p className="text-gray-300">Game not found: {gameId}</p>;

  // ✅ CREATE THIS HANDLER
  const handleBackToLobby = () => {
    if (socket) {
      // Tell the server to clean up the game state for this room
      socket.emit('end_game');
    }
    // Navigate back to the lobby page
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="text-white max-w-6xl mx-auto p-4">
      {/* ✅ CHANGE THIS FROM A <Link> TO A <button> THAT USES THE HANDLER */}
      <button
        onClick={handleBackToLobby}
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Lobby
      </button>

      <h1 className="text-4xl font-bold mb-6 capitalize">
        {gameId ? gameId.replace('-', ' ') : 'Game'}
      </h1>

      <div className="bg-gray-800 p-4 sm:p-8 rounded-lg shadow-lg min-h-[60vh]">
        <p className="text-lg mb-2">
          Welcome, <span className="font-bold">{username || 'Player'}</span>!
        </p>

        <div className="mt-4">
          {CurrentGame}
        </div>
      </div>
    </div>
  );
}

export default GamePage;