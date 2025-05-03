import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import BoardPage from './pages/BoardPage';
import './styles/index.css'; // Ensure global styles are imported

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* Route assumes board URLs like board.a1dos-creations.com/{boardId}
            This routing setup works if served from the root.
            If served from board.a1dos-creations.com, your hosting needs to
            direct all paths to this app, and the router handles the {boardId}. */}
        <Route path="/:boardId" element={<BoardPage />} />
        {/* Fallback or Not Found Page can be added here */}
      </Routes>
    </Router>
  );
}

export default App;