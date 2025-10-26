import React from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// ✅ Import all your game components here
import TicTacToe from '../components/TicTacToe/TicTacToe'; // adjust path if needed

function GamePage() {
  const { gameId } = useParams();
  const { socket, username, roomId } = useOutletContext();

  // ✅ Map game IDs to components
  const games = {
    'tic-tac-toe': <TicTacToe />,  // this one exists now
    // later you can add more:
    // 'chess': <ChessGame />,
    // 'uno': <UnoGame />,
  };

  // ✅ Select the right component based on URL
  const CurrentGame = games[gameId] || (
    <p className="text-gray-300">Game not found or not implemented yet.</p>
  );

  return (
    <div className="text-white">
      <Link
        to={`/room/${roomId}`}
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Lobby
      </Link>

      <h1 className="text-4xl font-bold mb-6 capitalize">
        {gameId.replace('-', ' ')}
      </h1>

      <div className="bg-gray-800 p-8 rounded-lg shadow-lg min-h-[60vh]">
        <p className="text-lg mb-2">
          Welcome, <span className="font-bold">{username}</span>!
        </p>

        {/* ✅ Here’s where your actual game renders */}
        <div className="mt-4">
          {CurrentGame}
        </div>
      </div>
    </div>
  );
}

export default GamePage;
