import React, { useEffect, useState } from 'react';
import ScrollToBottom from 'react-scroll-to-bottom';
import { useSocket } from '../SocketContext'; // Import the custom hook
import { Send, Users } from 'lucide-react'; // Import the Send and Users icons

function Chat() {
  // Get global state from context instead of props
  const { socket, username, roomId } = useSocket(); 
  
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false); // State to toggle view

  const scrollbarHideStyle = {
    // For Firefox
    scrollbarWidth: 'none',
    // For Chrome, Safari, and Opera
    'msOverflowStyle': 'none', // For IE and Edge
  };

  const webkitScrollbarHideStyle = `
    .scrollbar-container::-webkit-scrollbar {
      display: none;
    }
  `;

  const sendMessage = async () => {
    if (currentMessage !== "") {
      const messageData = {
        roomId: roomId,
        author: username,
        message: currentMessage,
        time:
          new Date(Date.now()).getHours() +
          ":" +
          String(new Date(Date.now()).getMinutes()).padStart(2, '0'),
      };

      await socket.emit("send_message", messageData);
      setMessageList((list) => [...list, messageData]);
      setCurrentMessage("");
    }
  };

  useEffect(() => {
    // Ensure socket is available before setting up listeners
    if (!socket) return;

    const messageHandler = (data) => {
      setMessageList((list) => [...list, data]);
    };

    const userJoinedHandler = (data) => {
      const notification = {
        isNotification: true,
        message: `${data.username} has joined the room`,
      };
      setMessageList((list) => [...list, notification]);
    };

    // --- NEW: Handler for when a user leaves ---
    const userLeftHandler = (data) => {
      const notification = {
        isNotification: true,
        message: `${data.username} has left the room`,
      };
      setMessageList((list) => [...list, notification]);
    };

    // --- NEW: Handler for participant list updates ---
    const participantListHandler = (data) => {
      setParticipants(data);
    };

    socket.on("receive_message", messageHandler);
    socket.on("user_joined", userJoinedHandler);
    socket.on("user_left", userLeftHandler); // Listen for user_left
    socket.on("update_participant_list", participantListHandler); // Listen for list update

    return () => {
      socket.off("receive_message", messageHandler);
      socket.off("user_joined", userJoinedHandler);
      socket.off("user_left", userLeftHandler);
      socket.off("update_participant_list", participantListHandler);
    };
  }, [socket, username]);

  return (
    // Main container with a modern dark theme
    <div className="w-full h-full bg-gray-900 text-gray-200 flex flex-col shadow-2xl">
      {/* Chat Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between shadow-md">
        <div>
          <h3 className="font-bold text-lg text-white">
            {showParticipants ? 'Participants' : 'Live Chat'}
          </h3>
          <p className="text-xs text-gray-400">Room: {roomId}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-green-400">Live</span>
          </div>
          {/* --- NEW: Participants Toggle Button --- */}
          <button
            onClick={() => setShowParticipants(prev => !prev)}
            className={`relative p-2 rounded-lg transition-colors ${
              showParticipants ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-label="Show participants"
          >
            <Users size={20} />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {participants.length}
            </span>
          </button>
        </div>
      </div>

      {/* Chat Body & Participant List Container */}
      {showParticipants ? (
        // --- PARTICIPANT LIST VIEW ---
        <div className="flex-grow p-4 overflow-y-auto">
          <h4 className="text-lg font-semibold text-white mb-4">
            In this room ({participants.length})
          </h4>
          <ul className="space-y-2">
            {participants.map((user) => (
              <li 
                key={user.id} 
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800"
              >
                <span className="h-3 w-3 bg-green-500 rounded-full flex-shrink-0 border-2 border-gray-900"></span>
                <span className="font-medium text-gray-200">{user.username}</span>
                {user.id === socket.id && (
                  <span className="text-xs text-blue-400 font-semibold ml-auto">(You)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // --- CHAT MESSAGE VIEW ---
        <>
        <style>{webkitScrollbarHideStyle}</style>
        <ScrollToBottom className="flex-grow p-4 overflow-y-auto scrollbar-hide" scrollViewClassName="scrollbar-container">
          {messageList.map((messageContent, index) => {
            if (messageContent.isNotification) {
              return (
                <div key={index} className="text-center my-3">
                  <p className="text-sm text-gray-500 bg-gray-800 px-3 py-1 rounded-full inline-block">
                    {messageContent.message}
                  </p>
                </div>
              );
            }
            
            const isYou = username === messageContent.author;
            return (
              <div
                key={index}
                className={`flex mb-4 ${isYou ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs md:max-w-md ${isYou ? 'items-end' : 'items-start'} flex flex-col`}>
                  {/* Author and Time - placed above the bubble */}
                  <div className={`text-xs text-gray-400 mb-1 ${isYou ? 'text-right' : 'text-left'}`}>
                    <span>{isYou ? "You" : messageContent.author}</span>
                    <span className="mx-1">&bull;</span>
                    <span>{messageContent.time}</span>
                  </div>
                  
                  {/* Message Bubble */}
                  <div
                    className={`p-3 rounded-lg text-white ${
                      isYou 
                        ? 'bg-blue-600 rounded-br-none' 
                        : 'bg-gray-700 rounded-bl-none'
                    }`}
                  >
                    <p className="break-words">{messageContent.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </ScrollToBottom>
        </>
      )}

      {/* Chat Footer - Input */}
      <div className="p-4 border-t border-gray-700 bg-gray-800 flex items-center gap-3">
        <input
          className="flex-grow p-3 border border-gray-600 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
          type="text"
          value={currentMessage}
          placeholder={showParticipants ? "Viewing participants..." : "Type a message..."}
          onChange={(event) => setCurrentMessage(event.target.value)}
          onKeyPress={(event) => {
            event.key === "Enter" && sendMessage();
          }}
          disabled={showParticipants} // Disable input when viewing participants
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send message"
          disabled={showParticipants} // Disable send button
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}

export default Chat;