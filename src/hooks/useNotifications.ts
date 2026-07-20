import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAppStore } from '../store/appStore';

export function useNotifications() {
  const { addListener } = useWebSocket();
  const addNotification = useAppStore((s) => s.addNotification);
  const setCall = useAppStore((s) => s.setCall);
  const addMessage = useAppStore((s) => s.addMessage);
  const activeConversation = useAppStore((s) => s.activeConversation);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().catch(() => {});
    }

    return addListener((event) => {
      if (event.type === 'new_message') {
        const payload = event.payload as { from: string; body: string; type?: 'text' | 'image' | 'video' | 'audio' };
        const title = 'New Message';
        const body = `${payload.from}: ${payload.body}`;
        addNotification({ title, body, type: 'message' });
        const isActive = activeConversation === payload.from;
        addMessage({
          id: crypto.randomUUID(),
          conversationId: payload.from,
          from: payload.from,
          to: '',
          body: payload.body,
          type: payload.type || 'text',
          direction: 'inbound',
          status: isActive ? 'read' : 'received',
          createdAt: new Date().toISOString(),
        });
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      }

      if (event.type === 'incoming_call') {
        const payload = event.payload as { from: string };
        const title = 'Incoming Call';
        const body = `Call from ${payload.from}`;
        addNotification({ title, body, type: 'call' });
        setCall({ status: 'incoming', remoteIdentity: payload.from });
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      }

      if (event.type === 'system_alert') {
        const payload = event.payload as { message: string };
        addNotification({ title: 'System Alert', body: payload.message, type: 'warning' });
      }
    });
  }, [addListener, addNotification, addMessage, setCall, activeConversation]);
}
