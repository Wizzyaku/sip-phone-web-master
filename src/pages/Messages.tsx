import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import axios from 'axios';
import {
  Send,
  RefreshCw,
  MessageSquare,
  Image as ImageIcon,
  X,
  Search,
  AlertCircle,
  Check,
  CheckCheck,
  FileAudio,
  Phone,
  Video as VideoIcon,
  MoreVertical,
  PlusCircle,
  PenSquare,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';
import { useAppStore, type Message, type MessageType } from '../store/appStore';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { MobileMessages } from '../components/MobileMessages';
import { LowBalanceModal } from '../components/LowBalanceModal';
import { hasEnoughBalance } from '../lib/balance';
import { supabase } from '../lib/supabase';

interface SmsMessage {
  sid: string;
  from: string;
  to: string;
  body: string;
  direction: 'inbound' | 'outbound';
  dateCreated: string;
  status?: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type FilterTab = 'all' | 'unread' | 'groups';
type MobileFilterTab = 'all' | 'sms' | 'webchat';

function getInitials(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || '??';
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function MessageContent({ msg }: { msg: Message }) {
  if (msg.type === 'image' && msg.mediaUrl) {
    return (
      <img
        src={msg.mediaUrl}
        alt={msg.mediaName || 'Image'}
        className="max-h-32 rounded-md object-cover md:max-h-48"
      />
    );
  }
  if (msg.type === 'video' && msg.mediaUrl) {
    return (
      <video src={msg.mediaUrl} controls className="max-h-32 rounded-md md:max-h-48">
        Your browser does not support the video tag.
      </video>
    );
  }
  if (msg.type === 'audio' && msg.mediaUrl) {
    return (
      <div className="flex items-center gap-2">
        <FileAudio className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
        <audio src={msg.mediaUrl} controls className="max-w-[140px] md:max-w-[200px]" />
      </div>
    );
  }
  return <span className="break-words">{msg.body}</span>;
}

export function Messages() {
  const conversations = useAppStore((s) => s.conversations);
  const activeId = useAppStore((s) => s.activeConversation);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);
  const setStoreMessages = useAppStore((s) => s.setMessages);
  const addStoreMessage = useAppStore((s) => s.addMessage);
  const mediaUploads = useAppStore((s) => s.mediaUploads);
  const addMediaUpload = useAppStore((s) => s.addMediaUpload);
  const removeMediaUpload = useAppStore((s) => s.removeMediaUpload);
  const telnyxNumber = useAppStore((s) => s.telnyxNumber);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [mobileFilter, setMobileFilter] = useState<MobileFilterTab>('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeNumber, setComposeNumber] = useState('');
  const [lowBalanceOpen, setLowBalanceOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDesktop = useIsDesktop();

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeId) || null;
  }, [conversations, activeId]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter((c) => c.unreadCount > 0);
    if (filter === 'groups') list = list.filter((c) => c.contact.includes('+') && c.contact.length > 12);
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (c) =>
        c.contact.toLowerCase().includes(query) ||
        c.contactName?.toLowerCase().includes(query) ||
        c.lastMessage?.body.toLowerCase().includes(query)
    );
  }, [conversations, search, filter]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    const currentNumber = useAppStore.getState().telnyxNumber;
    try {
      const res = await axios.get(`${API_URL}/messages`);
      const apiMessages: SmsMessage[] = res.data;
      const mapped: Message[] = apiMessages.map((m) => {
        const isFromMe = currentNumber ? m.from.trim() === currentNumber.trim() : m.direction === 'outbound';
        return {
          id: m.sid,
          conversationId: m.from === m.to ? m.to : getConversationId(m.from, m.to),
          from: m.from,
          to: m.to,
          body: m.body,
          type: 'text' as MessageType,
          direction: isFromMe ? ('outbound' as const) : ('inbound' as const),
          status: m.status || (isFromMe ? 'sent' : 'received'),
          createdAt: m.dateCreated,
        };
      });
      const current = useAppStore.getState().messages;
      const merged = current.map((sm) => {
        const apiMatch = mapped.find((m) => m.id === sm.id);
        if (!apiMatch) return sm;
        // Keep our local direction if it differs from the API's direction.
        return sm.direction === 'outbound' ? { ...apiMatch, direction: 'outbound' as const } : apiMatch;
      });
      const newApiMessages = mapped.filter((m) => !current.some((sm) => sm.id === m.id));
      setStoreMessages([...merged, ...newApiMessages]);
    } catch (err) {
      setError('Failed to load messages. Using local messages only.');
    } finally {
      setLoading(false);
    }
  }, [setStoreMessages]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length]);

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    const conversation = conversations.find((c) => c.id === id);
    if (conversation) {
      setTo(conversation.contact);
    }
  };

  const handleStartConversation = (e: React.FormEvent) => {
    e.preventDefault();
    const number = composeNumber.trim();
    if (!number) return;
    const id = telnyxNumber ? getConversationId(telnyxNumber, number) : number;
    const existing = conversations.find((c) => c.id === id || c.contact === number);
    if (existing) {
      handleSelectConversation(existing.id);
    } else {
      useAppStore.getState().setConversations([
        { id, contact: number, avatar: getInitials(number), unreadCount: 0, messages: [] },
        ...conversations,
      ]);
      setActiveConversation(id);
      setTo(number);
    }
    setComposeNumber('');
    setComposeOpen(false);
  };

  const getConversationId = (a: string, b: string) =>
    a === b ? a : [a.trim(), b.trim()].sort().join('|');

  const sendTextMessage = async () => {
    if (!to.trim() || !body.trim()) return;
    if (!telnyxNumber) {
      setError('No sender number configured. Go to Settings and verify your Telnyx number.');
      return;
    }
    const balance = useAppStore.getState().balance;
    if (!hasEnoughBalance(balance)) {
      setLowBalanceOpen(true);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        setError('You must be signed in to send messages.');
        setSending(false);
        return;
      }
      const res = await axios.post(
        `${API_URL}/send-sms`,
        {
          to: to.trim(),
          body: body.trim(),
          from: telnyxNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      addStoreMessage({
        id: res.data.sid || crypto.randomUUID(),
        conversationId: getConversationId(telnyxNumber, to.trim()),
        from: telnyxNumber,
        to: to.trim(),
        body: body.trim(),
        type: 'text',
        direction: 'outbound',
        status: res.data.status || 'sent',
        createdAt: new Date().toISOString(),
      });
      setBody('');
      await fetchMessages();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 402) {
        setLowBalanceOpen(true);
      } else {
        setError('Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  const sendMediaMessage = (type: MessageType, file: File, url: string) => {
    if (!to.trim() || !telnyxNumber) return;
    addStoreMessage({
      id: crypto.randomUUID(),
      conversationId: getConversationId(telnyxNumber, to.trim()),
      from: telnyxNumber,
      to: to.trim(),
      body: type === 'audio' ? 'Voice message' : file.name,
      type,
      mediaUrl: url,
      mediaName: file.name,
      direction: 'outbound',
      status: 'sent',
      createdAt: new Date().toISOString(),
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const upload = {
      id: crypto.randomUUID(),
      file,
      previewUrl: url,
      type,
      uploading: false,
    };
    addMediaUpload(upload);
    e.target.value = '';
  };

  const handleSendMedia = (uploadId: string) => {
    const upload = mediaUploads.find((u) => u.id === uploadId);
    if (!upload) return;
    sendMediaMessage(upload.type, upload.file, upload.previewUrl);
    removeMediaUpload(uploadId);
  };

  const handleRemoveMedia = (uploadId: string) => {
    const upload = mediaUploads.find((u) => u.id === uploadId);
    if (upload?.previewUrl) URL.revokeObjectURL(upload.previewUrl);
    removeMediaUpload(uploadId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mediaUploads.length > 0) {
      mediaUploads.forEach((u) => handleSendMedia(u.id));
    }
    sendTextMessage();
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'groups', label: 'Groups' },
  ];

  return (
    <div className="relative h-[calc(100vh-154px)] w-full min-w-0 overflow-hidden bg-background md:h-[calc(100vh-7.5rem)] md:rounded-2xl md:border md:border-border/30">
      {!isDesktop && (
        <div className="absolute inset-0">
        <MobileMessages
          conversations={conversations}
          activeConversation={activeConversation}
          loading={loading}
          error={error}
          telnyxNumber={telnyxNumber}
          to={to}
          body={body}
          sending={sending}
          search={search}
          mobileFilter={mobileFilter}
          composeNumber={composeNumber}
          composeOpen={composeOpen}
          mediaUploads={mediaUploads}
          imageInputRef={imageInputRef}
          videoInputRef={videoInputRef}
          textareaRef={textareaRef}
          chatEndRef={chatEndRef}
          setSearch={setSearch}
          setMobileFilter={setMobileFilter}
          setComposeOpen={setComposeOpen}
          setComposeNumber={setComposeNumber}
          setBody={setBody}
          setTo={setTo}
          handleSelectConversation={handleSelectConversation}
          handleStartConversation={handleStartConversation}
          sendTextMessage={sendTextMessage}
          handleSubmit={handleSubmit}
          handleFileSelect={handleFileSelect}
          handleRemoveMedia={handleRemoveMedia}
          fetchMessages={fetchMessages}
        />
        </div>
      )}
      {isDesktop && (
        <div className="flex h-full w-full overflow-hidden bg-[#F0F4F8] dark:bg-slate-950">
          {/* Left Pane: Chat List */}
          <section className="flex h-full w-[380px] shrink-0 flex-col border-r border-slate-200/60 dark:border-slate-700/50">
            {/* Header */}
            <div className="shrink-0 space-y-3 p-4 bg-white/80 backdrop-blur-md border-b border-slate-200/60 dark:bg-slate-900/80 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Messages</h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setComposeOpen((v) => !v)}
                    className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm active:scale-95 transition-transform hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800"
                    title="New conversation"
                  >
                    <PenSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={fetchMessages}
                    disabled={loading}
                    className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm active:scale-95 transition-transform hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    title="Refresh messages"
                  >
                    <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                  </button>
                </div>
              </div>
              {composeOpen && (
                <form onSubmit={handleStartConversation} className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={composeNumber}
                    onChange={(e) => setComposeNumber(e.target.value)}
                    placeholder="Enter phone number"
                    autoFocus
                    className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                  >
                    Start
                  </button>
                </form>
              )}
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats or contacts..."
                  className="w-full h-10 bg-white border border-slate-200 rounded-[14px] pl-10 pr-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              {/* Filter tabs */}
              <div className="flex gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFilter(t.id)}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-xs font-bold transition-all',
                      filter === t.id
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Chat list scroll */}
            <div className="flex-1 overflow-y-auto px-2 py-2 no-scrollbar">
              {loading && filteredConversations.length === 0 && (
                <div className="space-y-2 p-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                  ))}
                </div>
              )}
              {filteredConversations.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <MessageSquare className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-500">No conversations yet</p>
                  <p className="mt-1 max-w-[200px] text-xs text-slate-400">
                    Messages are fetched in real time. Start a conversation or check back once messages arrive.
                  </p>
                  {error && <p className="mt-2 max-w-[220px] text-xs text-red-500">{error}</p>}
                  <button
                    onClick={() => setComposeOpen(true)}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <PenSquare className="h-3.5 w-3.5" />
                    New conversation
                  </button>
                </div>
              )}
              <div className="space-y-1">
                {filteredConversations.map((conv) => {
                  const isActive = activeId === conv.id;
                  const unread = conv.unreadCount > 0;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all',
                        isActive
                          ? 'bg-white border border-indigo-100 shadow-sm dark:bg-slate-800 dark:border-indigo-900/50'
                          : 'hover:bg-white/60 dark:hover:bg-slate-800/50'
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="w-11 h-11 bg-slate-100 text-slate-600 border border-slate-100 shadow-sm dark:bg-slate-700 dark:text-slate-200">
                          <AvatarFallback className="text-xs font-bold">
                            {getInitials(conv.contactName || conv.contact)}
                          </AvatarFallback>
                        </Avatar>
                        {unread && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className={cn(
                            'truncate text-[13px] font-extrabold',
                            isActive ? 'text-indigo-600' : 'text-slate-800 dark:text-slate-100'
                          )}>
                            {conv.contactName || conv.contact}
                          </p>
                          <span className={cn(
                            'text-[10px] font-bold shrink-0 ml-2',
                            unread ? 'text-indigo-600' : 'text-slate-400'
                          )}>
                            {conv.lastMessage && formatRelative(conv.lastMessage.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] font-medium text-slate-500">
                            {conv.lastMessage?.type === 'text'
                              ? conv.lastMessage.body
                              : conv.lastMessage
                              ? `Sent ${conv.lastMessage.type}`
                              : ''}
                          </p>
                          {unread && (
                            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right Pane: Chat Window */}
          <section className="flex h-full flex-1 flex-col bg-[#F0F4F8] dark:bg-slate-950">
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <header className="flex h-16 shrink-0 items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 dark:bg-slate-900/80 dark:border-slate-700/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <Avatar className="w-10 h-10 bg-slate-100 text-slate-600 shadow-sm dark:bg-slate-700 dark:text-slate-200">
                        <AvatarFallback className="text-sm font-bold">
                          {getInitials(activeConversation.contactName || activeConversation.contact)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h2 className="text-[15px] font-extrabold text-slate-800 leading-tight truncate dark:text-slate-100">
                        {activeConversation.contactName || activeConversation.contact}
                      </h2>
                      <p className="text-[11px] font-bold text-emerald-600 leading-tight">Online</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="w-10 h-10 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors active:scale-90 dark:hover:bg-indigo-900/30">
                      <VideoIcon className="w-5 h-5" />
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors active:scale-90 dark:hover:bg-indigo-900/30">
                      <Phone className="w-5 h-5" />
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-colors active:scale-90 dark:hover:bg-slate-800">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </header>

                {/* Chat Messages Area */}
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 no-scrollbar">
                  <div className="flex justify-center shrink-0">
                    <span className="px-3 py-1 bg-white border border-slate-200/60 rounded-full text-[10px] font-extrabold text-slate-500 uppercase tracking-widest shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                      Today
                    </span>
                  </div>
                  {activeConversation.messages.map((msg) => {
                    const isSent = msg.direction === 'outbound';
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex items-end gap-2 max-w-[70%] animate-fade-in shrink-0',
                          isSent ? 'self-end' : 'self-start'
                        )}
                      >
                        <div
                          className={cn(
                            'p-3 rounded-[18px] shadow-sm',
                            isSent
                              ? 'bg-indigo-600 rounded-br-[4px] shadow-[0_4px_12px_rgba(79,70,229,0.2)]'
                              : 'bg-white border border-slate-200/60 rounded-bl-[4px] shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:bg-slate-800 dark:border-slate-700'
                          )}
                        >
                          <MessageContent msg={msg} />
                          <div className={cn(
                            'flex items-center gap-1 mt-1',
                            isSent ? 'justify-end' : 'justify-start'
                          )}>
                            <span className={cn(
                              'text-[9px] font-bold',
                              isSent ? 'text-white/70' : 'text-slate-400'
                            )}>
                              {formatTime(msg.createdAt)}
                            </span>
                            {isSent && (
                              <span className="flex items-center gap-0.5">
                                {msg.status === 'read' ? (
                                  <CheckCheck className="h-3 w-3 text-indigo-200" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="h-3 w-3 text-indigo-300" />
                                ) : (
                                  <Check className="h-3 w-3 text-indigo-300" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input Bar */}
                <footer className="shrink-0 bg-white/80 backdrop-blur-md border-t border-slate-200/60 px-4 py-3 dark:bg-slate-900/80 dark:border-slate-700/50">
                  {error && (
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-red-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {error}
                    </div>
                  )}
                  {mediaUploads.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {mediaUploads.map((upload) => (
                        <div key={upload.id} className="relative rounded-md border p-1.5">
                          {upload.type === 'image' ? (
                            <img src={upload.previewUrl} alt="preview" className="h-12 w-12 rounded object-cover" />
                          ) : upload.type === 'video' ? (
                            <video src={upload.previewUrl} className="h-12 w-12 rounded object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 dark:bg-slate-800">
                              <FileAudio className="h-5 w-5 text-slate-400" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMedia(upload.id)}
                            className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={handleSubmit} className="flex items-end gap-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, 'image')}
                    />
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, 'video')}
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-colors shrink-0 active:scale-95 dark:hover:bg-slate-800"
                      title="Attach image"
                    >
                      <PlusCircle className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-colors shrink-0 active:scale-95 dark:hover:bg-slate-800"
                      title="Attach video"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <div className="flex-grow bg-slate-50 border border-slate-200 rounded-[20px] min-h-[42px] flex items-center px-4 py-1 dark:bg-slate-800 dark:border-slate-700">
                      <input
                        type="tel"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="To"
                        className="w-20 bg-transparent border-none text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none border-r border-slate-200 pr-2 mr-2 dark:text-slate-100 dark:border-slate-600"
                      />
                      <textarea
                        ref={textareaRef}
                        value={body}
                        onChange={(e) => {
                          setBody(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                          }
                        }}
                        placeholder="Type a message..."
                        rows={1}
                        className="flex-1 bg-transparent border-none text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none resize-none max-h-[128px] py-1.5 dark:text-slate-100"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sending || !to.trim() || !telnyxNumber || (mediaUploads.length === 0 && !body.trim())}
                      className="w-11 h-11 flex items-center justify-center bg-indigo-600 text-white rounded-full transition-colors shrink-0 active:scale-90 shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-4 dark:bg-indigo-900/20">
                  <MessageSquare className="h-10 w-10 text-indigo-300" />
                </div>
                <p className="text-base font-extrabold text-slate-700 dark:text-slate-200">Select a conversation</p>
                <p className="mt-1 text-sm text-slate-400">Choose a contact from the list to start chatting.</p>
              </div>
            )}
          </section>
          <LowBalanceModal
            open={lowBalanceOpen}
            onClose={() => setLowBalanceOpen(false)}
            action="message"
          />
        </div>
      )}
    </div>
  );
}

export default memo(Messages);
