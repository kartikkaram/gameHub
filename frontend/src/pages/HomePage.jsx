import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../SocketContext';
import { LogIn, PlusSquare } from 'lucide-react';

function HomePage() {
  const [localUsername, setLocalUsername] = useState("");
  const [localRoomId, setLocalRoomId] = useState("");
  const navigate = useNavigate();
  const { socket, setUsername, setRoomId } = useSocket();

  const handleJoin = () => {
    if (socket && localUsername && localRoomId) {
      setUsername(localUsername);
      setRoomId(localRoomId);
      socket.emit("join_room", { username: localUsername, roomId: localRoomId });
      // Navigate to the base room URL, which will render the GameLobby
      navigate(`/room/${localRoomId}`);
    }
  };

  const handleCreate = () => {
    if (socket && localUsername) {
      const newRoomId = Math.random().toString(36).substring(2, 8);
      setUsername(localUsername);
      setRoomId(newRoomId);
      socket.emit("join_room", { username: localUsername, roomId: newRoomId });
      // Navigate to the base room URL, which will render the GameLobby
      navigate(`/room/${newRoomId}`);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center font-sans">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-3xl font-bold mb-6 text-center text-gray-800">Game Space</h3>
        <input
          className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          type="text"
          placeholder="Enter Your Name..."
          onChange={(e) => setLocalUsername(e.target.value)}
        />
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="text-lg font-semibold text-gray-700 mb-2 text-center">Join Existing Room</h4>
          <input
            className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            type="text"
            placeholder="Room ID..."
            onChange={(e) => setLocalRoomId(e.target.value)}
          />
          <button onClick={handleJoin} className="w-full bg-green-600 text-white p-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
            <LogIn size={20} /> Join Room
          </button>
        </div>
        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>
        <button onClick={handleCreate} className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
          <PlusSquare size={20} /> Create A New Room
        </button>
      </div>
    </div>
  );
}

export default HomePage;