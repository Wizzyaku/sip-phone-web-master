import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSip, type ActiveCall } from '../hooks/useSip';
import { fetchSipCredentials } from '../lib/sipCredentials';
import { useAppStore } from '../store/appStore';
import { useIsDesktop } from '../hooks/useIsDesktop';

interface SipContextValue {
  status: ReturnType<typeof useSip>['status'];
  error: ReturnType<typeof useSip>['error'];
  activeCall: ActiveCall | null;
  register: ReturnType<typeof useSip>['register'];
  unregister: ReturnType<typeof useSip>['unregister'];
  call: ReturnType<typeof useSip>['call'];
  hangup: ReturnType<typeof useSip>['hangup'];
  toggleMute: ReturnType<typeof useSip>['toggleMute'];
  toggleSpeaker: ReturnType<typeof useSip>['toggleSpeaker'];
  acceptCall: ReturnType<typeof useSip>['acceptCall'];
  rejectCall: ReturnType<typeof useSip>['rejectCall'];
}

const SipContext = createContext<SipContextValue | null>(null);

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function SipProvider({ children }: { children: ReactNode }) {
  const sip = useSip();
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const setSipSettings = useAppStore((s) => s.setSipSettings);

  useEffect(() => {
    let mounted = true;
    fetchSipCredentials().then((settings) => {
      if (mounted && settings) {
        setSipSettings(settings);
      }
    });
    return () => {
      mounted = false;
    };
  }, [setSipSettings]);

  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio || !sip.activeCall?.remoteStream) return;
    audio.srcObject = sip.activeCall.remoteStream;
    audio.volume = 1;
    audio.play().catch((err) => {
      console.warn('[SIP] Audio play failed:', err);
    });
  }, [sip.activeCall?.remoteStream]);

  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.muted = !sip.activeCall?.speakerOn;
  }, [sip.activeCall?.speakerOn]);

  return (
    <SipContext.Provider value={sip}>
      {children}
      <audio ref={remoteAudioRef} className="hidden" autoPlay playsInline />
      <CallModal />
    </SipContext.Provider>
  );
}

function CallModal() {
  const { activeCall, hangup, toggleMute, toggleSpeaker, acceptCall, rejectCall } = useSipContext();
  const isDesktop = useIsDesktop();
  const [recording, setRecording] = useState(false);

  if (!activeCall) return null;

  const isRingingIncoming = activeCall.direction === 'incoming' && activeCall.status === 'Ringing';
  const displayIdentity = activeCall.remoteIdentity
    .replace(/^sip:/i, '')
    .replace(/@sip\.telnyx\.com$/i, '');

  const toggleRecording = () => setRecording((r) => !r);

  // Shared call info
  const callInfo = (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(
        'w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold text-white shadow-2xl',
        activeCall.direction === 'incoming' ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-gradient-to-br from-indigo-400 to-purple-600'
      )}>
        {displayIdentity.charAt(0).toUpperCase()}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
        {activeCall.direction === 'incoming' ? 'Incoming call' : 'Outgoing call'}
      </p>
      <h2 className="text-2xl font-extrabold text-white tracking-tight max-w-full truncate" title={displayIdentity}>
        {displayIdentity}
      </h2>
      <div className="flex items-center gap-2 mt-1">
        <span className={cn(
          'text-sm font-bold px-3 py-1 rounded-full',
          activeCall.status === 'In call' ? 'bg-emerald-500/20 text-emerald-300' :
          activeCall.status === 'Ringing' ? 'bg-amber-500/20 text-amber-300' :
          'bg-white/10 text-white/70'
        )}>
          {activeCall.status}
        </span>
        {activeCall.status === 'In call' && activeCall.startTime && (
          <span className="text-sm font-bold text-white/90 tabular-nums">
            {formatDuration(activeCall.durationSeconds)}
          </span>
        )}
      </div>
    </div>
  );

  // Shared controls
  const inCallControls = (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={toggleMute}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90',
          activeCall.muted ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-white/10 text-white hover:bg-white/20'
        )}
        aria-label={activeCall.muted ? 'Unmute' : 'Mute'}
      >
        {activeCall.muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </button>
      <button
        onClick={toggleSpeaker}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90',
          activeCall.speakerOn ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/10 text-white hover:bg-white/20'
        )}
        aria-label={activeCall.speakerOn ? 'Turn speaker off' : 'Turn speaker on'}
      >
        {activeCall.speakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
      </button>
      <button
        onClick={toggleRecording}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90',
          recording ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
        )}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
      >
        <Circle className={cn('w-6 h-6', recording && 'animate-pulse')} fill={recording ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={hangup}
        className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-500/40 hover:bg-red-600 active:scale-90 transition-all"
        aria-label="Hang up"
      >
        <PhoneOff className="w-7 h-7" />
      </button>
    </div>
  );

  const ringingControls = (
    <div className="flex items-center justify-center gap-6">
      <button
        onClick={rejectCall}
        className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-500/40 hover:bg-red-600 active:scale-90 transition-all"
        aria-label="Reject call"
      >
        <PhoneOff className="w-7 h-7" />
      </button>
      <button
        onClick={acceptCall}
        className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/40 hover:bg-emerald-600 active:scale-90 transition-all"
        aria-label="Accept call"
      >
        <Phone className="w-7 h-7" fill="currentColor" />
      </button>
    </div>
  );

  if (!isDesktop) {
    // Mobile: Full screen with gradient background
    return (
      <div className="fixed inset-0 z-[100] flex flex-col animate-slide-in-right">
        <div className={cn(
          'absolute inset-0',
          activeCall.direction === 'incoming'
            ? 'bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-900'
            : 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900'
        )} />

        <div className="relative flex-1 flex flex-col items-center justify-between py-16 px-6">
          {/* Top: Recording indicator */}
          <div className="w-full flex items-center justify-between">
            <button
              onClick={toggleRecording}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                recording ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40'
              )}
            >
              <Circle className={cn('w-3 h-3', recording && 'animate-pulse')} fill={recording ? 'currentColor' : 'none'} />
              {recording ? 'Recording' : 'Record'}
            </button>
            {recording && (
              <span className="text-xs font-bold text-red-400 animate-pulse">● REC</span>
            )}
          </div>

          {/* Center: Call info */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {callInfo}
          </div>

          {/* Bottom: Controls */}
          <div className="pb-8">
            {isRingingIncoming ? ringingControls : inCallControls}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Right-side slide-out modal, ~50% width, full height
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={cn(
          'relative w-1/2 h-full flex flex-col animate-slide-in-right',
          activeCall.direction === 'incoming'
            ? 'bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-900'
            : 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900'
        )}
      >
        <div className="flex-1 flex flex-col items-center justify-between py-12 px-8">
          {/* Top: Recording indicator */}
          <div className="w-full flex items-center justify-between">
            <button
              onClick={toggleRecording}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                recording ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40'
              )}
            >
              <Circle className={cn('w-3 h-3', recording && 'animate-pulse')} fill={recording ? 'currentColor' : 'none'} />
              {recording ? 'Recording' : 'Record'}
            </button>
            {recording && (
              <span className="text-xs font-bold text-red-400 animate-pulse">● REC</span>
            )}
          </div>

          {/* Center: Call info */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {callInfo}
          </div>

          {/* Bottom: Controls */}
          <div className="pb-6">
            {isRingingIncoming ? ringingControls : inCallControls}
          </div>
        </div>
      </div>
    </div>
  );
}

export function useSipContext() {
  const context = useContext(SipContext);
  if (!context) {
    throw new Error('useSipContext must be used within a SipProvider');
  }
  return context;
}
