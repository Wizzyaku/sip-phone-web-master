import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useSip, type ActiveCall } from '../hooks/useSip';
import { fetchSipCredentials } from '../lib/sipCredentials';
import { useAppStore } from '../store/appStore';

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
      <IncomingCallBanner />
    </SipContext.Provider>
  );
}

function IncomingCallBanner() {
  const { activeCall, hangup, toggleMute, toggleSpeaker, acceptCall, rejectCall } = useSipContext();

  if (!activeCall) return null;

  const isRingingIncoming = activeCall.direction === 'incoming' && activeCall.status === 'Ringing';
  const displayIdentity = activeCall.remoteIdentity
    .replace(/^sip:/i, '')
    .replace(/@sip\.telnyx\.com$/i, '');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24">
      <Card className="w-full max-w-sm overflow-hidden border-border bg-background shadow-2xl">
        <CardContent className="flex flex-col items-center gap-4 p-5">
          {/* Call status */}
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
              {activeCall.direction === 'incoming' ? 'Incoming call' : 'Outgoing call'}
            </p>
            <p className="mt-1 max-w-[260px] truncate text-xl font-bold text-foreground" title={displayIdentity}>
              {displayIdentity}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {activeCall.status}
              </Badge>
              {activeCall.status === 'In call' && activeCall.startTime && (
                <Badge variant="secondary" className="text-[10px]">
                  {formatDuration(activeCall.durationSeconds)}
                </Badge>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex w-full items-center justify-center gap-4">
            {isRingingIncoming ? (
              <>
                <Button
                  variant="default"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-green-600 text-white shadow-lg shadow-green-600/25 hover:bg-green-700"
                  onClick={acceptCall}
                  aria-label="Accept call"
                >
                  <Phone className="h-5 w-5" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-lg shadow-destructive/25"
                  onClick={rejectCall}
                  aria-label="Reject call"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={activeCall.muted ? 'default' : 'outline'}
                  size="icon"
                  className={cn(
                    'h-12 w-12 rounded-full shadow-sm',
                    activeCall.muted && 'bg-amber-500 text-white hover:bg-amber-600'
                  )}
                  onClick={toggleMute}
                  aria-label={activeCall.muted ? 'Unmute' : 'Mute'}
                >
                  {activeCall.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  variant={activeCall.speakerOn ? 'default' : 'outline'}
                  size="icon"
                  className={cn(
                    'h-12 w-12 rounded-full shadow-sm',
                    activeCall.speakerOn && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                  onClick={toggleSpeaker}
                  aria-label={activeCall.speakerOn ? 'Turn speaker off' : 'Turn speaker on'}
                >
                  {activeCall.speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-12 w-12 rounded-full shadow-lg shadow-destructive/25"
                  onClick={hangup}
                  aria-label="Hang up"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
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
