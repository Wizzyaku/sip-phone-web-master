import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MessageSquare,
  PenSquare,
  ArrowLeft,
  Phone,
  Video as VideoIcon,
  Plus,
  Mic,
  Send,
  X,
  Check,
  CheckCheck,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';
import { type Conversation, type MessageType, type MediaUpload } from '../store/appStore';

type MobileFilterTab = 'all' | 'sms' | 'webchat';

interface MobileMessagesProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  loading: boolean;
  error: string | null;
  telnyxNumber: string | null;
  to: string;
  body: string;
  sending: boolean;
  search: string;
  mobileFilter: MobileFilterTab;
  composeNumber: string;
  composeOpen: boolean;
  mediaUploads: MediaUpload[];
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  setSearch: (value: string) => void;
  setMobileFilter: (value: MobileFilterTab) => void;
  setComposeOpen: (open: boolean) => void;
  setComposeNumber: (value: string) => void;
  setBody: (value: string) => void;
  setTo: (value: string) => void;
  handleSelectConversation: (id: string) => void;
  handleStartConversation: (e: React.FormEvent) => void;
  sendTextMessage: () => Promise<void>;
  handleSubmit: (e: React.FormEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => void;
  handleRemoveMedia: (id: string) => void;
  fetchMessages: () => Promise<void>;
}

function getInitials(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || '??';
}

function isSmsContact(contact: string) {
  return /^\+?\d/.test(contact.replace(/[\s()\-]/g, ''));
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

export function MobileMessages(props: MobileMessagesProps) {
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    setChatOpen(!!props.activeConversation);
  }, [props.activeConversation]);

  const filteredConversations = useMemo(() => {
    let list = props.conversations;
    if (props.mobileFilter === 'sms') list = list.filter((c) => isSmsContact(c.contact));
    if (props.mobileFilter === 'webchat') list = list.filter((c) => !isSmsContact(c.contact));
    const query = props.search.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (c) =>
        c.contact.toLowerCase().includes(query) ||
        c.contactName?.toLowerCase().includes(query) ||
        c.lastMessage?.body.toLowerCase().includes(query)
    );
  }, [props.conversations, props.mobileFilter, props.search]);

  const handleOpenChat = (id: string) => {
    props.handleSelectConversation(id);
    setChatOpen(true);
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    props.setTo('');
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[#F0F4F8] dark:bg-slate-950">
      {/* ========================================== */}
      {/* VIEW 1: CHAT LIST                          */}
      {/* ========================================== */}
      <div className="flex flex-col h-full w-full transition-transform duration-300">
        {/* Scrollable List Content */}
        <div className="flex-grow overflow-y-auto no-scrollbar px-4 pt-3 pb-28 flex flex-col gap-3.5">
          {/* Search */}
          <div className="animate-fade-in shrink-0">
            <div className="relative w-full shadow-[0_2px_8px_rgba(15,23,42,0.02)]">
              <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none w-[18px] h-[18px] my-auto" />
              <input
                type="text"
                value={props.search}
                onChange={(e) => props.setSearch(e.target.value)}
                placeholder="Search chats or contacts..."
                className="w-full h-11 bg-white border border-slate-200 rounded-[14px] pl-10 pr-3 text-[13px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Chat List Container */}
          <div className="animate-fade-in animate-delay-100 shrink-0 bg-white border border-slate-200/80 rounded-[20px] shadow-[0_4px_15px_rgba(15,23,42,0.03)] flex flex-col divide-y divide-slate-100 dark:bg-slate-900 dark:border-slate-700/50 dark:divide-slate-700/50">
            {props.loading && filteredConversations.length === 0 && (
              <div className="p-3.5 flex flex-col gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32 rounded" />
                      <Skeleton className="h-2 w-48 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!props.loading && filteredConversations.length === 0 && (
              <div className="p-6 flex flex-col items-center justify-center text-center">
                <MessageSquare className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-400">No conversations yet</p>
                {props.error && <p className="mt-1 text-xs text-red-500">{props.error}</p>}
              </div>
            )}

            {filteredConversations.map((conv) => {
              const unread = conv.unreadCount > 0;
              const last = conv.lastMessage;
              return (
                <div
                  key={conv.id}
                  onClick={() => handleOpenChat(conv.id)}
                  className="p-3.5 flex items-center gap-3 active:bg-slate-50 transition-colors cursor-pointer dark:active:bg-slate-800"
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-12 h-12 bg-slate-100 text-slate-600 border border-slate-100 shadow-sm dark:bg-slate-700 dark:text-slate-200">
                      <AvatarFallback className="text-xs font-bold">
                        {getInitials(conv.contactName || conv.contact)}
                      </AvatarFallback>
                    </Avatar>
                    {!isSmsContact(conv.contact) && (
                      <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex flex-col flex-grow min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h4 className="text-[14px] font-extrabold text-slate-800 truncate dark:text-slate-100">
                        {conv.contactName || conv.contact}
                      </h4>
                      <span className={cn(
                        'text-[10px] font-extrabold shrink-0',
                        unread ? 'text-indigo-600' : 'text-slate-400'
                      )}>
                        {last ? formatRelative(last.createdAt) : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className={cn(
                        'text-[12px] truncate',
                        unread ? 'font-semibold text-slate-800 dark:text-slate-200' : 'font-medium text-slate-500'
                      )}>
                        {last?.type === 'text' ? last.body : last ? `Sent ${last.type}` : ''}
                      </p>
                      {unread && (
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-2 opacity-50">
            <span className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" /> End-to-end encrypted
            </span>
          </div>
        </div>

        {/* Floating new message button */}
        <button
          onClick={() => props.setComposeOpen(true)}
          className="absolute bottom-24 right-5 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[18px] flex items-center justify-center shadow-[0_8px_25px_rgba(79,70,229,0.4)] z-40 active:scale-90 transition-transform"
        >
          <PenSquare className="w-6 h-6" />
        </button>
      </div>

      {/* ========================================== */}
      {/* VIEW 2: SLIDE-IN CHAT WINDOW               */}
      {/* ========================================== */}
      <div
        className={cn(
          'absolute inset-0 bg-[#F0F4F8] dark:bg-slate-950 z-[100] flex flex-col transition-transform duration-300',
          chatOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {props.activeConversation ? (
          <>
            {/* Chat Header */}
            <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 pt-4 pb-2 px-3 flex items-center justify-between shrink-0 z-20 dark:bg-slate-900/90 dark:border-slate-700/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={handleCloseChat}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors active:scale-90 flex items-center -ml-1"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-2.5 cursor-pointer">
                  <div className="relative shrink-0">
                    <Avatar className="w-9 h-9 bg-slate-100 text-slate-600 shadow-sm dark:bg-slate-700 dark:text-slate-200">
                      <AvatarFallback className="text-xs font-bold">
                        {getInitials(props.activeConversation.contactName || props.activeConversation.contact)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-[14px] font-extrabold text-slate-800 leading-tight dark:text-slate-100">
                      {props.activeConversation.contactName || props.activeConversation.contact}
                    </h2>
                    <p className="text-[10px] font-bold text-emerald-600 leading-tight">Online</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="w-9 h-9 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors active:scale-90">
                  <VideoIcon className="w-5 h-5" />
                </button>
                <button className="w-9 h-9 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors active:scale-90">
                  <Phone className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Chat Messages Area */}
            <div className="flex-grow overflow-y-auto px-4 py-5 flex flex-col gap-4 relative no-scrollbar">
              <div className="flex justify-center shrink-0">
                <span className="px-3 py-1 bg-white border border-slate-200/60 rounded-full text-[9px] font-extrabold text-slate-500 uppercase tracking-widest shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                  Today
                </span>
              </div>
              {props.activeConversation.messages.map((msg) => {
                const isSent = msg.direction === 'outbound';
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex items-end gap-2 max-w-[85%] animate-fade-in shrink-0',
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
                      <p className={cn(
                        'text-[13px] font-medium leading-relaxed',
                        isSent ? 'text-white' : 'text-slate-800 dark:text-slate-100'
                      )}>
                        {msg.body}
                      </p>
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
                          <>
                            {msg.status === 'read' ? (
                              <CheckCheck className="w-3 h-3 text-indigo-200" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3 h-3 text-indigo-300" />
                            ) : (
                              <Check className="w-3 h-3 text-indigo-300" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={props.chatEndRef} />
              <div className="h-2 shrink-0" />
            </div>

            {/* Chat Input Bar */}
            <div className="shrink-0 bg-white/90 backdrop-blur-xl border-t border-slate-200/80 px-3 py-3 pb-8 dark:bg-slate-900/90 dark:border-slate-700/50">
              {props.error && (
                <div className="mb-2 flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {props.error}
                </div>
              )}
              {props.mediaUploads.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {props.mediaUploads.map((upload) => (
                    <div key={upload.id} className="relative rounded-md border p-1.5">
                      {upload.type === 'image' ? (
                        <img src={upload.previewUrl} alt="preview" className="h-10 w-10 rounded object-cover" />
                      ) : upload.type === 'video' ? (
                        <video src={upload.previewUrl} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100">
                          <MessageSquare className="h-4 w-4 text-slate-400" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => props.handleRemoveMedia(upload.id)}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={props.handleSubmit} className="flex items-end gap-2">
                <input
                  ref={props.imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => props.handleFileSelect(e, 'image')}
                />
                <input
                  ref={props.videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => props.handleFileSelect(e, 'video')}
                />
                <button
                  type="button"
                  onClick={() => props.imageInputRef.current?.click()}
                  className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-colors shrink-0 active:scale-95 dark:hover:bg-slate-800"
                >
                  <Plus className="w-6 h-6" />
                </button>
                <div className="flex-grow bg-slate-50 border border-slate-200 rounded-[20px] min-h-[40px] flex items-center px-3 py-1 dark:bg-slate-800 dark:border-slate-700">
                  <textarea
                    ref={props.textareaRef}
                    value={props.body}
                    onChange={(e) => {
                      props.setBody(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        props.handleSubmit(e);
                      }
                    }}
                    placeholder="Message"
                    rows={1}
                    className="w-full bg-transparent border-none text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none resize-none max-h-[100px] py-1.5 dark:text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={props.sending || !props.to.trim() || !props.telnyxNumber || (props.mediaUploads.length === 0 && !props.body.trim())}
                  className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full transition-colors shrink-0 active:scale-90 shadow-sm disabled:opacity-50"
                >
                  {props.body.trim() ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>

      {/* New message compose modal */}
      {props.composeOpen && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => props.setComposeOpen(false)} />
          <div className="relative flex w-full flex-col rounded-t-[28px] bg-white pb-6 pt-3 shadow-[0_-15px_40px_rgba(0,0,0,0.2)] transition-transform dark:bg-slate-900">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200 mb-3 dark:bg-slate-700" />
            <div className="flex items-center justify-between border-b border-slate-100 px-4 pb-2 pt-1 dark:border-slate-700">
              <h2 className="text-[16px] font-extrabold text-slate-800 dark:text-slate-100">New Message</h2>
              <button
                onClick={() => props.setComposeOpen(false)}
                className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 active:scale-95 dark:bg-slate-800"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
            <form onSubmit={props.handleStartConversation} className="flex flex-col gap-4 px-4 py-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2 dark:border-slate-700">
                <span className="w-10 text-sm font-bold text-slate-500">To:</span>
                <input
                  type="text"
                  value={props.composeNumber}
                  onChange={(e) => props.setComposeNumber(e.target.value)}
                  placeholder="Type a name or phone number"
                  autoFocus
                  className="flex-1 border-0 bg-transparent px-0 text-sm font-semibold text-slate-800 placeholder-slate-400 shadow-none focus:ring-0 focus:outline-none dark:text-slate-100"
                />
              </div>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2 dark:border-slate-700">
                <span className="w-10 text-sm font-bold text-slate-500">From:</span>
                <div className="flex flex-1 items-center gap-2">
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">SMS</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{props.telnyxNumber || '+1 (555) 012-3456'}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <textarea
                  value={props.body}
                  onChange={(e) => props.setBody(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                  className="no-scrollbar w-full resize-none bg-transparent text-sm leading-relaxed text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="h-12 w-full gap-2 rounded-xl bg-indigo-600 text-white text-[14px] font-bold shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition-all active:scale-[0.98] hover:bg-indigo-500"
              >
                <Send className="w-4 h-4 inline mr-2" /> Send SMS
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
