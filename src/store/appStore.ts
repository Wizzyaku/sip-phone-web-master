import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchBalance, type Balance } from '../lib/balance';

export interface User {
  name: string;
  email: string;
  avatar: string;
  bio?: string;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'call' | 'message';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'audio';

export interface Message {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  body: string;
  type: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  direction: 'inbound' | 'outbound';
  status: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  contact: string;
  contactName?: string;
  avatar: string;
  lastMessage?: Message;
  unreadCount: number;
  messages: Message[];
}

export interface CallState {
  status: 'idle' | 'dialing' | 'incoming' | 'connecting' | 'in-progress' | 'ended' | 'error';
  remoteIdentity?: string;
  muted: boolean;
  speakerOn: boolean;
  startTime?: string;
  durationSeconds: number;
  error?: string;
}

export interface SipSettings {
  username: string;
  password: string;
  phoneNumber: string;
}

export interface MediaUpload {
  id: string;
  file: File;
  previewUrl: string;
  type: MessageType;
  uploading: boolean;
  error?: string;
}

interface AppState {
  user: User;
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  telnyxNumber: string | null;
  sipSettings: SipSettings | null;
  notifications: Notification[];
  messages: Message[];
  conversations: Conversation[];
  activeConversation: string | null;
  call: CallState;
  mediaUploads: MediaUpload[];
  balance: Balance | null;
  balanceLoading: boolean;
  setUser: (user: User) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setTelnyxNumber: (number: string | null) => void;
  setSipSettings: (settings: SipSettings | null) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => string;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  setCall: (call: Partial<CallState>) => void;
  resetCall: () => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setConversations: (conversations: Conversation[]) => void;
  updateConversation: (conversation: Conversation) => void;
  addMediaUpload: (upload: MediaUpload) => void;
  removeMediaUpload: (id: string) => void;
  setMediaUploadError: (id: string, error: string) => void;
  clearMediaUploads: () => void;
  setBalance: (balance: Balance | null) => void;
  refreshBalance: () => Promise<void>;
  incrementBalance: (tokens: number) => void;
}

function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getAvatar(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';
}

function buildConversations(messages: Message[]): Conversation[] {
  const map = new Map<string, Message[]>();
  for (const msg of messages) {
    const key = msg.conversationId || (msg.from === msg.to ? msg.to : [msg.from, msg.to].sort().join('|'));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  }
  const conversations: Conversation[] = [];
  for (const [id, msgs] of map.entries()) {
    const sorted = msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const last = sorted[sorted.length - 1];
    const inbound = sorted.filter((m) => m.direction === 'inbound');
    const unread = inbound.filter((m) => m.status !== 'read').length;
    const contact = last?.direction === 'inbound' ? last.from : last?.to || id;
    const contactName = last?.direction === 'inbound' ? last.from : last?.to;
    conversations.push({
      id,
      contact,
      contactName,
      avatar: getAvatar(contactName || contact),
      lastMessage: last,
      unreadCount: unread,
      messages: sorted,
    });
  }
  return conversations.sort((a, b) => {
    const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: {
        name: 'Alex Telnyx',
        email: 'alex@example.com',
        avatar: 'AT',
      },
      theme: 'system',
      resolvedTheme: 'light',
      telnyxNumber: null,
      sipSettings: null,
      notifications: [],
      messages: [],
      conversations: [],
      activeConversation: null,
      call: {
        status: 'idle',
        muted: false,
        speakerOn: true,
        durationSeconds: 0,
      },
      mediaUploads: [],
      balance: null,
      balanceLoading: false,
      setUser: (user) => set({ user }),
      setTheme: (theme) => {
        const resolvedTheme = resolveTheme(theme);
        document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
        set({ theme, resolvedTheme });
      },
      setTelnyxNumber: (telnyxNumber) => set({ telnyxNumber }),
      setSipSettings: (sipSettings) => set({ sipSettings }),
      addNotification: (notification) => {
        const now = new Date().toISOString();
        const existing = get().notifications.find(
          (n) =>
            n.title === notification.title &&
            n.body === notification.body &&
            n.type === notification.type &&
            new Date(n.createdAt).getTime() > Date.now() - 10000
        );
        if (existing) return existing.id;
        const id = crypto.randomUUID();
        const item: Notification = {
          ...notification,
          id,
          read: false,
          createdAt: now,
        };
        const notifications = [item, ...get().notifications].slice(0, 50);
        set({ notifications });
        return id;
      },
      markNotificationRead: (id) => {
        set({
          notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        });
      },
      markAllNotificationsRead: () => {
        set({
          notifications: get().notifications.map((n) => ({ ...n, read: true })),
        });
      },
      dismissNotification: (id) => {
        set({ notifications: get().notifications.filter((n) => n.id !== id) });
      },
      clearNotifications: () => set({ notifications: [] }),
      setCall: (call) => set({ call: { ...get().call, ...call } }),
      resetCall: () => set({ call: { status: 'idle', muted: false, speakerOn: true, durationSeconds: 0 } }),
      setActiveConversation: (id) => {
        set({ activeConversation: id });
        if (id) {
          const updated = get().conversations.map((c) =>
            c.id === id
              ? {
                  ...c,
                  unreadCount: 0,
                  messages: c.messages.map((m) => (m.direction === 'inbound' ? { ...m, status: 'read' } : m)),
                }
              : c
          );
          set({ conversations: updated });
          set({
            messages: get().messages.map((m) =>
              m.conversationId === id && m.direction === 'inbound' ? { ...m, status: 'read' } : m
            ),
          });
        }
      },
      setMessages: (messages) => {
        set({ messages, conversations: buildConversations(messages) });
      },
      addMessage: (message) => {
        const messages = [message, ...get().messages];
        set({ messages, conversations: buildConversations(messages) });
      },
      setConversations: (conversations) => set({ conversations }),
      updateConversation: (conversation) => {
        set({
          conversations: get().conversations.map((c) => (c.id === conversation.id ? conversation : c)),
        });
      },
      addMediaUpload: (upload) => set({ mediaUploads: [...get().mediaUploads, upload] }),
      removeMediaUpload: (id) => set({ mediaUploads: get().mediaUploads.filter((u) => u.id !== id) }),
      setMediaUploadError: (id, error) => {
        set({
          mediaUploads: get().mediaUploads.map((u) => (u.id === id ? { ...u, error, uploading: false } : u)),
        });
      },
      clearMediaUploads: () => set({ mediaUploads: [] }),
      setBalance: (balance) => set({ balance }),
      refreshBalance: async () => {
        set({ balanceLoading: true });
        const balance = await fetchBalance();
        set({ balance, balanceLoading: false });
      },
      incrementBalance: (tokens) => {
        set((state) => ({
          balance: state.balance
            ? { ...state.balance, tokens: state.balance.tokens + tokens, updatedAt: new Date().toISOString() }
            : { tokens, updatedAt: new Date().toISOString() },
        }));
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.refreshBalance();
        }
      },
    }
  )
);

export function initTheme() {
  const theme = useAppStore.getState().theme;
  const resolvedTheme = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  useAppStore.setState({ resolvedTheme });
}

export function unreadCount(state: AppState): number {
  return state.notifications.filter((n) => !n.read).length;
}

export function unreadMessages(state: AppState): number {
  return state.conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}
