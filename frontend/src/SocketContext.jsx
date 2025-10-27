import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [participants, setParticipants] = useState([]); // State for participants

  useEffect(() => {
    // Connect to the server
    const newSocket = io.connect("http://localhost:3001");
    setSocket(newSocket);

    // Listen for participant list updates from the server
    const handleParticipantList = (list) => {
      setParticipants(list);
    };
    newSocket.on('update_participant_list', handleParticipantList);

    // Clean up the listener when the component unmounts
    return () => {
      newSocket.off('update_participant_list', handleParticipantList);
      newSocket.disconnect();
    };
  }, []); // This effect runs only once

  const value = {
    socket,
    username,
    setUsername,
    roomId,
    setRoomId,
    participants, // Expose participants to the whole app
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};