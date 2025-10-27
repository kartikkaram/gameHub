import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../SocketContext'; 
import { Gamepad2, Play, LayoutGrid, UserPlus, X, Mail } from 'lucide-react';

/**
 * @description A reusable modal for the host to select players to invite.
 */
const InviteModal = ({ participants, onInvite, onCancel }) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  const handleTogglePlayer = (playerId) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  return (
    // This div provides the modal backdrop
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-700 animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Invite Players</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>
        <ul className="space-y-2 max-h-60 overflow-y-auto mb-4">
          {participants.length > 0 ? participants.map(p => (
            <li key={p.id}>
              <label className="flex items-center gap-3 bg-gray-700 p-3 rounded-md cursor-pointer hover:bg-gray-600 transition-colors">
                <input 
                  type="checkbox"
                  className="h-5 w-5 rounded bg-gray-900 border-gray-600 text-blue-500 focus:ring-blue-600"
                  checked={selectedPlayers.includes(p.id)}
                  onChange={() => handleTogglePlayer(p.id)}
                />
                {p.username}
              </label>
            </li>
          )) : (
            <p className="text-gray-400 text-center p-4">No other players in the lobby to invite.</p>
          )}
        </ul>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500">Cancel</button>
          <button 
            onClick={() => onInvite(selectedPlayers)} 
            disabled={participants.length === 0 || selectedPlayers.length === 0}
            className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Send Invites
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * @description A notification banner shown to players who receive a game invitation.
 */
const InvitationNotification = ({ invitation, onAccept, onDecline }) => {
  if (!invitation) return null;

  return (
    <div className="fixed top-5 right-5 z-50 bg-gray-700 text-white p-4 rounded-lg shadow-lg border border-blue-500 animate-fade-in-down">
      <div className="flex items-start gap-4">
        <Mail className="text-blue-400 mt-1" size={24} />
        <div>
          <h4 className="font-bold">Game Invitation</h4>
          <p className="text-sm text-gray-300">
            <span className="font-semibold">{invitation.host.username}</span> has invited you to play <span className="font-semibold capitalize">{invitation.gameId}</span>.
          </p>
          <div className="mt-3 flex gap-3">
            <button onClick={onAccept} className="px-3 py-1 bg-green-600 text-sm rounded hover:bg-green-700">Accept</button>
            <button onClick={onDecline} className="px-3 py-1 bg-red-600 text-sm rounded hover:bg-red-700">Decline</button>
          </div>
        </div>
      </div>
    </div>
  );
};


/**
 * @description The main lobby component where game sessions are managed.
 */
function GameLobby() {
  const { socket, username, roomId, participants } = useSocket();
  const navigate = useNavigate();

  // --- State Management ---
  const [session, setSession] = useState(null);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  
  /**
   * @description The game ID for which the invite modal is open (e.g., 'uno').
   * @type {null | string}
   */
  const [gameToInvite, setGameToInvite] = useState(null);
  
  /**
   * @description Holds invitation data received from the server.
   * @type {null | {gameId: string, host: object}}
   */
  const [invitation, setInvitation] = useState(null);

  // --- Derived State ---
  const isHost = participants.length > 0 && participants[0].id === socket?.id;
  const otherPlayers = participants.filter(p => p.id !== socket?.id);

  // --- Event Handlers ---

  /**
   * @description Called when the host clicks "Invite" on a game card.
   * It sets which game is being invited to and opens the modal.
   */
  const handleOpenInviteModal = (gameId) => {
    if (!isHost) return;
    setGameToInvite(gameId);
    setInviteModalOpen(true);
  };

  /**
   * @description Host sends the list of invited players to the server to create the session.
   */
  const handleCreateSessionAndInvite = (selectedPlayerIds) => {
    if (!isHost || !gameToInvite) return;
    // This event now correctly includes the players to be invited.
    socket.emit('create_session', { gameId: gameToInvite, invitedPlayerIds: selectedPlayerIds });
    setInviteModalOpen(false); // Close the modal
    setGameToInvite(null); // Reset the game selection
  };
  
  /**
   * @description Called when a user wants to leave a pre-game session.
   */
  const handleLeaveSession = () => socket.emit('leave_session');

  /**
   * @description Called when the host starts the game for players in the session.
   */
  const handleStartGame = () => socket.emit('start_game');

  /**
   * @description Player accepts an invitation, notifying the server.
   */
  const handleAcceptInvite = () => {
    if (!invitation) return;
    socket.emit('accept_invite', { gameId: invitation.gameId });
    setInvitation(null); // Clear the invitation notification
  };

  /**
   * @description Player declines an invitation. This is a client-side only action.
   */
  const handleDeclineInvite = () => {
    setInvitation(null); // Simply hide the notification
  };

  // --- Socket Event Listeners ---
  useEffect(() => {
    if (!socket) return;
    
    // --- State Sync Listeners ---
    const onSessionUpdate = (sessionData) => setSession(sessionData);
    const onSessionEnded = () => setSession(null);
    const onInvitation = (inviteData) => setInvitation(inviteData);

    // --- Navigation Listeners ---
    const onGameStart = (gameId) => navigate(`/room/${roomId}/game/${gameId}`);
    // These listeners are for *after* the game starts, to navigate all players.
    // We listen for the specific game state to know which game to route to.
    const onUnoGameStart = () => onGameStart('uno');
    const onTicTacToeGameStart = () => onGameStart('tic-tac-toe');

    socket.on('session_updated', onSessionUpdate);
    socket.on('session_ended', onSessionEnded);
    socket.on('game_invitation', onInvitation); // ✅ Listen for personal invitations
    socket.on('uno:gameState', onUnoGameStart);
    socket.on('tictactoe:gameState', onTicTacToeGameStart);

    return () => {
      socket.off('session_updated', onSessionUpdate);
      socket.off('session_ended', onSessionEnded);
      socket.off('game_invitation', onInvitation);
      socket.off('uno:gameState', onUnoGameStart);
      socket.off('tictactoe:gameState', onTicTacToeGameStart);
    };
  }, [socket, navigate, roomId]);


  return (
    <div className="text-white">
      {/* --- Global Components --- */}
      <InvitationNotification 
        invitation={invitation} 
        onAccept={handleAcceptInvite} 
        onDecline={handleDeclineInvite} 
      />
      {isInviteModalOpen && (
        <InviteModal 
          participants={otherPlayers}
          onCancel={() => setInviteModalOpen(false)}
          onInvite={handleCreateSessionAndInvite}
        />
      )}

      {/* --- Conditional Rendering: Session View vs. Lobby View --- */}
      {session ? (
        // --- SESSION VIEW ---
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 capitalize">{session.gameId} Session</h3>
            <p className="text-gray-400 mb-4">Players in this session:</p>
            <ul className="space-y-2 mb-6">
              {session.players.map((p) => (
                <li key={p.id} className="bg-gray-700 p-3 rounded-md font-medium flex justify-between items-center">
                  {p.username}
                  {p.id === session.host.id && <span className="text-xs text-yellow-300">(Host)</span>}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-4">
              {isHost ? (
                <button onClick={handleStartGame} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2">
                  <Play size={20} /> Start Game
                </button>
              ) : (
                 <p className="text-gray-300">Waiting for host to start...</p>
              )}
              <button onClick={handleLeaveSession} className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700">
                {isHost ? 'Cancel' : 'Leave'}
              </button>
            </div>
          </div>
          <PlayerList participants={participants} />
        </div>
      ) : (
        // --- DEFAULT LOBBY VIEW ---
        <>
          <h1 className="text-4xl font-bold mb-4">Game Lobby</h1>
          <p className="text-lg text-gray-300 mb-8">Welcome, <span className="font-bold">{username}</span>!</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold mb-4">Available Games</h3>
              <GameCard 
                title="Uno" 
                icon={<Gamepad2 size={32} className="text-blue-400" />}
                description="The classic card game for 2-10 players."
                isHost={isHost}
                onInvite={() => handleOpenInviteModal('uno')}
              />
              <GameCard 
                title="Tic-Tac-Toe" 
                icon={<LayoutGrid size={32} className="text-rose-400" />}
                description="The classic 3-in-a-row game. Requires exactly 2 players."
                isHost={isHost}
                onInvite={() => handleOpenInviteModal('tic-tac-toe')}
              />
            </div>
            <PlayerList participants={participants} />
          </div>
        </>
      )}
    </div>
  );
}

// --- Reusable Sub-Components ---

const GameCard = ({ title, icon, description, isHost, onInvite, disabled = false }) => (
  <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-2xl font-semibold">{title}</h3>
      </div>
      {isHost ? (
        <button 
          onClick={onInvite}
          disabled={disabled}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          <UserPlus size={20} />
          Invite
        </button>
      ) : (
        <p className="text-gray-400 text-sm">Waiting for host...</p>
      )}
    </div>
    <p className="text-gray-400 text-sm">{description}</p>
  </div>
);

const PlayerList = ({ participants }) => (
  <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
    <h3 className="text-2xl font-semibold mb-4">Players in Lobby ({participants.length})</h3>
    <ul className="space-y-3">
      {participants.map((p, index) => (
        <li key={p.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md">
          <span className="font-medium">{p.username}</span>
          {index === 0 && <span className="text-xs text-yellow-300 font-bold bg-yellow-800/50 px-2 py-1 rounded-full">HOST</span>}
        </li>
      ))}
    </ul>
  </div>
);



export default GameLobby;