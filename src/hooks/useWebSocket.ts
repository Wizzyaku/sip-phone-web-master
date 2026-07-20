import { useEffect, useRef, useState } from 'react';

export type WebSocketEvent = {
  type: 'incoming_call' | 'new_message' | 'system_alert';
  payload: Record<string, unknown>;
};

type Listener = (event: WebSocketEvent) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Listener[]>([]);

  const addListener = (listener: Listener) => {
    listenersRef.current.push(listener);
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== listener);
    };
  };

  const emit = (event: WebSocketEvent) => {
    listenersRef.current.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        console.error('WebSocket listener error:', err);
      }
    });
  };

  useEffect(() => {
    const url = import.meta.env.VITE_WS_URL;
    if (!url) {
      console.warn('VITE_WS_URL is not set. Real-time notifications are disabled.');
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
      ws.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as WebSocketEvent;
          emit(event);
        } catch {
          console.warn('Invalid WebSocket message:', message.data);
        }
      };
    } catch (err) {
      console.error('WebSocket connection failed:', err);
    }

    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connected, addListener };
}
