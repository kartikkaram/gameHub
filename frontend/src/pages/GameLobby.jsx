import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';

function GameLobby() {
  // useOutletContext allows us to get the context passed from RoomPage's <Outlet />
  const { roomId } = useOutletContext();

  return (
    <div className="text-white">
      <h1 className="text-4xl font-bold mb-4">Game Lobby</h1>
      <p className="text-lg text-gray-300 mb-8">
        Welcome! You are in room <span className="font-bold text-blue-400">{roomId}</span>.
        Choose a game to play with your friends.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Game 1 Link */}
        <Link 
          to={`/room/${roomId}/game/tic-tac-toe`}
          className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-blue-500/30 hover:bg-gray-700 transition-all transform hover:-translate-y-1"
        >
          <Gamepad2 size={40} className="mb-4 text-blue-400" />
          <h3 className="text-2xl font-semibold mb-2">Tic-Tac-Toe</h3>
          <p className="text-gray-400">The classic game of X's and O's.</p>
        </Link>
        
        {/* More games can be added here */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg opacity-50">
          <Gamepad2 size={40} className="mb-4 text-gray-600" />
          <h3 className="text-2xl font-semibold mb-2">Checkers</h3>
          <p className="text-gray-500">(Coming Soon)</p>
        </div>
      </div>
    </div>
  );
}

export default GameLobby;