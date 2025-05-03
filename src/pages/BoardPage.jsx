import React, { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { useParams } from 'react-router-dom';
import WhiteboardCanvas from '../components/WhiteboardCanvas';
import Toolbar from '../components/Toolbar';
import useWebSocket from '../hooks/useWebSocket';
import { WS_BASE_URL, MAX_IMAGES_PER_USER } from '../config';
import { generateUniqueId } from '../utils/helpers';
import '../styles/BoardPage.css';

// Reducer for managing board state
const boardReducer = (state, action) => {
  switch (action.type) {
    case 'SET_INITIAL_STATE':
        // Assuming backend sends the full initial state upon connection or request
        return { ...state, elements: action.payload.elements || [] , isLoading: false };
    case 'ADD_ELEMENT':
      // Avoid adding duplicates if message is received back from server
      if (state.elements.some(el => el.id === action.payload.id)) {
        return state;
      }
      return { ...state, elements: [...state.elements, action.payload] };
    case 'UPDATE_ELEMENT':
      return {
        ...state,
        elements: state.elements.map(el =>
          el.id === action.payload.id ? { ...el, ...action.payload.attrs } : el
        ),
      };
    case 'DELETE_ELEMENT':
       return {
        ...state,
        elements: state.elements.filter(el => el.id !== action.payload.id),
      };
     case 'SET_LOADING':
        return { ...state, isLoading: action.payload };
    case 'CLEAR_BOARD': // Example action
        return { ...state, elements: [] };
    default:
      return state;
  }
};

function BoardPage() {
  const { boardId } = useParams();
  const wsUrl = boardId ? `${WS_BASE_URL}/${boardId}` : null;

  const [boardState, dispatch] = useReducer(boardReducer, { elements: [], isLoading: true });
  const [selectedTool, setSelectedTool] = useState('select'); // 'select', 'draw', 'text', 'sticky', 'image'
  const [drawOptions, setDrawOptions] = useState({ stroke: '#000000', strokeWidth: 3 });
  const [currentActionId, setCurrentActionId] = useState(null); // Track local action to avoid echo issues
  const uploadedImageCount = useRef(0); // Track image uploads for this session/user

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message) => {
    // console.log("Received message:", message);
    // Prevent processing echo of own actions if backend doesn't handle it
    if (message.actionId && message.actionId === currentActionId) {
        // console.log("Ignoring echo message:", message.type);
        setCurrentActionId(null); // Reset action ID
        return;
    }

    switch (message.type) {
      case 'initial_state': // Backend sends the full board state
          dispatch({ type: 'SET_INITIAL_STATE', payload: message.payload });
          break;
      case 'element_add':
        dispatch({ type: 'ADD_ELEMENT', payload: message.payload });
        break;
      case 'element_update':
        dispatch({ type: 'UPDATE_ELEMENT', payload: message.payload });
        break;
      case 'element_delete':
          dispatch({ type: 'DELETE_ELEMENT', payload: message.payload });
          break;
      case 'board_cleared': // Example: if backend supports clearing
          dispatch({ type: 'CLEAR_BOARD' });
          break;
      // Add handlers for other message types like user cursors, etc.
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }, [currentActionId]); // Include currentActionId dependency

  const { isConnected, sendMessage, error: wsError } = useWebSocket(wsUrl, handleWebSocketMessage);

  // Function to send actions via WebSocket
  const sendAction = useCallback((type, payload) => {
      const actionId = generateUniqueId();
      setCurrentActionId(actionId); // Track this action locally
      sendMessage({ type, payload, actionId }); // Include actionId
  }, [sendMessage]);


  // Handler for element changes originating from the canvas
  const handleCanvasChange = useCallback((actionType, elementData) => {
    // Optimistic update (optional but good for UX)
    // The reducer might handle this based on the action type if needed,
    // or we rely purely on the WS echo for simplicity here.

    // Send the change to the server
    sendAction(actionType, elementData);
  }, [sendAction]);

   // Handler for image uploads from Toolbar
  const handleImageAdd = useCallback((imageDataUrl) => {
    if (uploadedImageCount.current >= MAX_IMAGES_PER_USER) {
        alert(`You can only upload up to ${MAX_IMAGES_PER_USER} images.`);
        return;
    }

    const newImage = {
      id: generateUniqueId(),
      type: 'image',
      attrs: {
        x: 100 + Math.random() * 200, // Random initial position
        y: 100 + Math.random() * 200,
        src: imageDataUrl,
        width: 150, // Default size, Konva will adjust based on image load
        height: 150,
        // Add isDraggable: true if needed, or handle in ElementRenderer
      }
    };
    // Optimistic update
    dispatch({ type: 'ADD_ELEMENT', payload: newImage });
    // Send to server
    sendAction('element_add', newImage);
    uploadedImageCount.current += 1;
  }, [sendAction]);


  useEffect(() => {
      // You might want to request initial state explicitly if WS doesn't send it automatically
      // E.g., upon connection: sendMessage({ type: 'get_initial_state' });
       if (isConnected && boardState.isLoading) {
            // If still loading after connect, maybe request state explicitly
           console.log("Connected, requesting initial state if needed...");
           // sendMessage({ type: 'get_initial_state', payload: { boardId } }); // Example
        }
  }, [isConnected, boardId, sendMessage, boardState.isLoading]); // Add dependencies


  return (
    <div className="board-page-container">
      <Toolbar
        selectedTool={selectedTool}
        onToolSelect={setSelectedTool}
        drawOptions={drawOptions}
        onDrawOptionsChange={setDrawOptions}
        onImageAdd={handleImageAdd}
        canAddImage={uploadedImageCount.current < MAX_IMAGES_PER_USER}
      />
      <div className="canvas-container">
        {boardState.isLoading && <div className="loading-overlay">Loading board...</div>}
        {wsError && <div className="error-overlay">Connection Error: {wsError}</div>}
        {!boardState.isLoading && (
             <WhiteboardCanvas
                elements={boardState.elements}
                onCanvasChange={handleCanvasChange} // Send changes to backend
                selectedTool={selectedTool}
                drawOptions={drawOptions}
             />
         )}
      </div>
       <div className="status-bar">
            Status: {isConnected ? <span style={{color: 'green'}}>Connected</span> : <span style={{color: 'red'}}>Disconnected</span>} | Board ID: {boardId}
        </div>
    </div>
  );
}

export default BoardPage;