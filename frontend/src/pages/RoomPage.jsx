import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useSocket } from '../SocketContext';
import Chat from '../components/Chat';

function RoomPage() {
  const { socket, username, setUsername, setRoomId } = useSocket();
  const { roomId: urlRoomId } = useParams(); // Get room ID from URL
  const navigate = useNavigate();

  useEffect(() => {
    // This handles the case where a user refreshes the page or
    // joins via a direct link.
    if (!username) {
      // If we don't have a username, ask for it.
      const newName = prompt("Please enter your name to join");
      if (newName) {
        setUsername(newName);
        setRoomId(urlRoomId);
        socket.emit("join_room", { username: newName, roomId: urlRoomId });
      } else {
        // If they cancel, send them home
        navigate('/');
      }
    }
  }, [username, urlRoomId, setUsername, setRoomId, socket, navigate]);

  if (!username) {
    // Show a loading state or nothing while we wait for the prompt/redirect
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
        <Outlet context={{ socket, username, roomId: urlRoomId }} />
      </div>
    </div>
  );
}

export default RoomPage;
