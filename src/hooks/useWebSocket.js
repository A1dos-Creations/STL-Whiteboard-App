import { useState, useEffect, useRef, useCallback } from 'react';

const useWebSocket = (url, onMessageCallback) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const messageQueue = useRef([]); // Queue messages if sent before connection is open

  const connect = useCallback(() => {
    if (!url) return; // Don't connect if URL is not provided yet

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
    }

    console.log(`Attempting to connect WebSocket to ${url}...`);
    setError(null);
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      setError(null);
      clearTimeout(reconnectTimeout.current); // Clear any scheduled reconnect
       // Send any queued messages
      messageQueue.current.forEach(msg => ws.current?.send(msg));
      messageQueue.current = [];
    };

    ws.current.onmessage = (event) => {
      // console.log('WebSocket message received:', event.data);
      try {
        const message = JSON.parse(event.data);
        if (onMessageCallback) {
          onMessageCallback(message);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setError('WebSocket connection error');
      setIsConnected(false);
      // Optionally implement exponential backoff for retries
    };

    ws.current.onclose = (event) => {
      console.log(`WebSocket Disconnected: ${event.code} ${event.reason}`);
      setIsConnected(false);
      ws.current = null; // Clean up the ref
      // Attempt to reconnect after a delay, unless it was a clean close
      if (!event.wasClean && url) {
         console.log('Attempting to reconnect WebSocket...');
         clearTimeout(reconnectTimeout.current); // Ensure only one timeout is active
         reconnectTimeout.current = setTimeout(connect, 5000); // Reconnect after 5 seconds
      }
    };
  }, [url, onMessageCallback]);

  const sendMessage = useCallback((message) => {
    const messageString = JSON.stringify(message);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      // console.log('Sending WebSocket message:', messageString);
      ws.current.send(messageString);
    } else {
      console.warn('WebSocket not connected. Queuing message:', messageString);
      // Queue the message if the connection isn't open yet
       messageQueue.current.push(messageString);
       // Attempt to connect if not already trying
       if (!ws.current || (ws.current.readyState !== WebSocket.CONNECTING && ws.current.readyState !== WebSocket.OPEN)) {
           connect();
       }
    }
  }, [connect]); // Include connect in dependencies

  useEffect(() => {
    connect(); // Initial connection attempt

    return () => {
      // Cleanup on unmount
      clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        console.log('Closing WebSocket connection on component unmount.');
        ws.current.close(1000, "Client disconnecting"); // 1000 is normal closure
        ws.current = null;
      }
      messageQueue.current = []; // Clear queue on unmount
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]); // Re-run effect if URL changes, connect handles actual connection logic

  return { isConnected, sendMessage, error };
};

export default useWebSocket;