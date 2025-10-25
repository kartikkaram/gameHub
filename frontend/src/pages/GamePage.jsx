import React from 'react';
import { useParams, Link, useOutletContext } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function GamePage() {
  const { gameId } = useParams();
  const { socket, username, roomId } = useOutletContext();

  return (
    <div className="text-white">
      <Link 
        to={`/room/${roomId}`} 
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Lobby
      </Link>
      
      <h1 className="text-4xl font-bold mb-4 capitalize">{gameId.replace('-', ' ')}</h1>
      
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg min-h-[50vh]">
        <p className="text-lg">
          Welcome, <span className="font-bold">{username}</span>!
        </p>
        <p className="text-gray-300">
          The actual game logic for <span className="font-bold">{gameId}</span> using the socket connection would go here.
        </p>
        
        {/* Example: A simple button to interact with the game */}
        <button 
          onClick={() => socket.emit('game_action', { gameId, action: 'start' })}
          className="mt-6 bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

export default GamePage;
