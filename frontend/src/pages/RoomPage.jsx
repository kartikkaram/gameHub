import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../SocketContext';
import Chat from '../components/Chat';

function RoomPage() {
  const { socket, username, setUsername, setRoomId } = useSocket();
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // This guard clause is the fix.
    // It tells the effect: "If the socket isn't ready yet, do nothing."
    if (!socket) return;

    // This logic now only runs when the socket connection is established.
    if (!username) {
      const newName = prompt("Please enter your name to join");
      if (newName) {
        setUsername(newName);
        setRoomId(urlRoomId);
        // This line is now safe because we know 'socket' is not null.
        socket.emit("join_room", { username: newName, roomId: urlRoomId });
      } else {
        // If they cancel, send them home
        navigate('/');
      }
    }
  }, [socket, username, urlRoomId, setUsername, setRoomId, navigate]); // 'socket' is now a dependency

  // This loading state is still useful while we wait for the username prompt
  if (!username) {
    return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="flex h-screen w-full bg-gray-900 text-white">
      {/* Left Side: Fixed Chat */}
      <div className="w-full max-w-sm md:w-1/3 lg:w-1/4 h-full flex flex-col border-r border-gray-700">
        <Chat />
      </div>
      
      {/* Right Side: Dynamic Game Area */}
      <div className="flex-1 h-full p-6 md:p-8 overflow-y-auto">
        {/* The nested routes (Lobby, GamePage) will render here */}
        <Outlet />
      </div>
    </div>
  );
}

export default RoomPage;