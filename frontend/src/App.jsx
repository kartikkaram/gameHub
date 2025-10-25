import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import GameLobby from './pages/GameLobby';
import GamePage from './pages/GamePage';

function App() {
  return (
    <Routes>
      {/* Route 1: The home page to join/create a room */}
      <Route path="/" element={<HomePage />} />
      
      {/* Route 2: The main room layout */}
      <Route path="/room/:roomId" element={<RoomPage />}>
        {/* These are nested routes. They will render inside RoomPage's <Outlet /> */}
        
        {/* The default page shown inside the room */}
        <Route index element={<GameLobby />} /> 
        
        {/* A specific game page */}
        <Route path="game/:gameId" element={<GamePage />} />
      </Route>
    </Routes>
  );
}

export default App;
