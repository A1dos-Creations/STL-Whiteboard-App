import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import '../styles/BoardPage.css'; // Reuse some styles for consistency

function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const createBoard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Assume your backend expects a POST request to create a board
      // and returns { boardId: 'newlyGeneratedId' }
      const response = await fetch(`${API_BASE_URL}/api/boards`, { // Adjust endpoint if needed
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
         // Add body if required by your API (e.g., user info)
         // body: JSON.stringify({ createdBy: 'someUserId' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create board: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.boardId) {
        // Navigate to the new board URL
        // Assumes your domain/hosting is set up for board.a1dos-creations.com/{boardId}
        // This navigate call works for client-side routing *within* the app.
        // If board.a1dos-creations.com is a separate deployment, you might need:
        // window.location.href = `https://board.a1dos-creations.com/${data.boardId}`;
        navigate(`/${data.boardId}`);
      } else {
        throw new Error('Invalid response from server: Missing boardId');
      }
    } catch (err) {
      console.error('Error creating board:', err);
      setError(`Could not create board. ${err.message}`);
      setIsLoading(false);
    }
    // No need to setLoading(false) on success because we navigate away
  };

  return (
    <div className="home-page-container">
      <h1>Collaborative Whiteboard</h1>
      <p>Create a new board to start collaborating.</p>
      <button onClick={createBoard} disabled={isLoading} className="create-board-button">
        {isLoading ? 'Creating...' : 'Create New Board'}
      </button>
      {error && <p className="error-message">{error}</p>}
       <p className="info-text">You will be redirected to a unique URL for your board.</p>
    </div>
  );
}

export default HomePage;