import React, { useEffect, useState } from 'react';
import { useSocket } from '../../SocketContext';

// --- Helper Function ---
// This function checks if a card is legally playable
function isCardPlayable(card, discardTop, currentColor) {
  if (!discardTop) return true; // Should only happen on first turn if it's a wild
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === discardTop.value) return true;
  return false;
}

// --- Card Component ---
function UnoCard({ card, onClick, isPlayable, isMyTurn }) {
  const cardColorClass = {
    red: 'bg-red-500', yellow: 'bg-yellow-400 text-black',
    green: 'bg-green-500', blue: 'bg-blue-500', wild: 'bg-gray-700'
  };

  const isDisabled = !isMyTurn || !isPlayable;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-24 h-36 m-1 rounded-lg text-white font-bold text-xl shadow-lg flex flex-col justify-between p-2 transition-all duration-150
        ${cardColorClass[card.color]} 
        ${isDisabled
          ? 'opacity-50 cursor-not-allowed grayscale-[50%]'
          : 'cursor-pointer hover:-translate-y-2 hover:ring-4 hover:ring-white'
        }
      `}
    >
      <span className="self-start">{card.value}</span>
      <span className="text-3xl">{card.value}</span>
      <span className="self-end rotate-180">{card.value}</span>
    </button>
  );
}

// --- Notification Component ---
function GameNotification({ message }) {
  if (!message) return null;
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce z-50">
      <p className="font-bold">{message}</p>
    </div>
  );
}

// --- Main Game Component ---
function UnoGame() {
  const { socket, username } = useSocket();
  const [gameState, setGameState] = useState(null);
  const [notification, setNotification] = useState(""); // For toasts

  // --- Effect for handling socket events ---
  useEffect(() => {
    if (!socket) return;

    socket.emit('uno:getGameState'); // Ask for state on load

    // Clear notification after 3 seconds
    let timer;
    if (notification) {
      timer = setTimeout(() => setNotification(""), 3000);
    }

    // --- Socket Event Handlers ---
    const handleGameState = (state) => setGameState(state);
    const handleError = (error) => setNotification(`Error: ${error.message}`);
    const handleMessage = (data) => setNotification(data.message);
    const handleRoundOver = (data) => setNotification(`Round Over! Winner: ${data.winner}`);
    const handleUnoDeclared = (data) => setNotification(`${data.username} has declared UNO!`);

    const handleDrawnCardPlayable = (data) => {
      if (window.confirm(`You drew a ${data.card.color} ${data.card.value}. Do you want to play it?`)) {
        playCardHandler(data.card); // Use the main handler
      } else {
        socket.emit('uno:passTurn');
      }
    };

    socket.on('uno:gameState', handleGameState);
    socket.on('uno:error', handleError);
    socket.on('uno:message', handleMessage);
    socket.on('uno:roundOver', handleRoundOver);
    socket.on('uno:unoDeclared', handleUnoDeclared);
    socket.on('uno:drawnCardPlayable', handleDrawnCardPlayable);

    return () => {
      socket.off('uno:gameState', handleGameState);
      socket.off('uno:error', handleError);
      socket.off('uno:message', handleMessage);
      socket.off('uno:roundOver', handleRoundOver);
      socket.off('uno:unoDeclared', handleUnoDeclared);
      socket.off('uno:drawnCardPlayable', handleDrawnCardPlayable);
      clearTimeout(timer);
    };
  }, [socket, notification]); // Rerun effect if notification changes (to clear it)

  // --- Game Action Handlers ---
  const playCardHandler = (card) => {
    let chosenColor = null;
    if (card.color === 'wild') {
      chosenColor = prompt("Choose a color: red, green, blue, yellow");
      while (!['red', 'green', 'blue', 'yellow'].includes(chosenColor?.toLowerCase())) {
        chosenColor = prompt("Invalid color. Choose: red, green, blue, or yellow");
      }
    }
    
    // --- UNO! LOGIC FIX ---
    // Automatically call UNO! if playing your second-to-last card.
    if (gameState.myHand.length === 2) {
      socket.emit('uno:declareUno');
    }
    
    socket.emit('uno:playCard', { card, chosenColor });
  };

  const drawCardHandler = () => socket.emit('uno:drawCard');
  
  const declareUnoHandler = () => {
    // This button is for when you forget, or when you draw and are left with one card.
    socket.emit('uno:declareUno');
  };

  // --- Render Logic ---
  if (!gameState) {
    return <div className="text-white text-center text-2xl">Waiting for game to start...</div>;
  }

  const isMyTurn = gameState.players.find(p => p.username === username)?.isCurrentPlayer;

  return (
    <div className="p-4 text-white relative">
      <GameNotification message={notification} />
      
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl">Discard Pile</h2>
          <p className="text-sm text-gray-400">Current Color: <span className="font-bold uppercase">{gameState.currentColor}</span></p>
        </div>
        {isMyTurn && <p className="text-2xl font-bold text-green-400 animate-pulse">It's Your Turn!</p>}
        <div>
          <h2 className="text-xl">Players</h2>
        </div>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div className="flex">
          {gameState.discardTop && <UnoCard card={gameState.discardTop} />}
          <button onClick={drawCardHandler} disabled={!isMyTurn} className="w-24 h-36 m-1 rounded-lg bg-gray-900 text-white font-bold flex items-center justify-center text-2xl shadow-lg border-2 border-dashed border-gray-600 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
            DRAW
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {gameState.players.map(p => (
            <div key={p.id} className={`px-4 py-2 rounded-lg ${p.isCurrentPlayer ? 'bg-blue-600' : 'bg-gray-700'}`}>
              <span className="font-bold">{p.username}</span> ({p.cardCount} cards)
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl mb-2">Your Hand ({gameState.myHand.length})</h2>
        <div className="bg-gray-900 p-4 rounded-lg flex flex-wrap justify-center min-h-[10rem]">
          {gameState.myHand.map((card, i) => {
            // --- UNPLAYABLE CARD LOGIC ---
            const playable = isCardPlayable(card, gameState.discardTop, gameState.currentColor);
            return (
              <UnoCard 
                key={i} 
                card={card} 
                onClick={() => playCardHandler(card)} 
                isPlayable={playable}
                isMyTurn={isMyTurn}
              />
            );
          })}
        </div>
        <button onClick={declareUnoHandler} className="mt-4 bg-yellow-500 text-black font-bold py-2 px-4 rounded-lg hover:bg-yellow-400">
          Call UNO!
        </button>
      </div>
    </div>
  );
}

export default UnoGame;