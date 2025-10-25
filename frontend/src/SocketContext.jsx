import React, { createContext, useContext, useState } from 'react';
import io from 'socket.io-client';

// 1. Initialize the socket connection
// We connect once and reuse this instance
const socket = io.connect("http://localhost:3001");

// 2. Create the context
const SocketContext = createContext();

// 3. Create a custom hook for easy access
export const useSocket = () => {
  return useContext(SocketContext);
};

// 4. Create the Provider component
export const SocketProvider = ({ children }) => {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");

  const value = {
    socket,
    username,
    setUsername,
    roomId,
    setRoomId,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
