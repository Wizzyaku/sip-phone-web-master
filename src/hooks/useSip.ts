import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Invitation,
  Inviter,
  Registerer,
  RegistererState,
  Session,
  SessionState,
  UserAgent,
} from 'sip.js';
import type { UserAgentOptions } from 'sip.js';
import { useAppStore, type SipSettings } from '../store/appStore';

// Telnyx/FreeSWITCH sometimes sends SDPs without `a=rtcp-mux`, but modern
// browsers require it when the peer connection is in the default
// rtcp-mux-required mode. Inject the attribute into remote descriptions that
// are missing it so calls can proceed.
const originalSetRemoteDescription = RTCPeerConnection.prototype.setRemoteDescription as (
  description: RTCSessionDescriptionInit | RTCSessionDescription
) => Promise<void>;
RTCPeerConnection.prototype.setRemoteDescription = function (
  description: RTCSessionDescriptionInit | RTCSessionDescription
): Promise<void> {
  if (description && description.sdp && !description.sdp.includes('a=rtcp-mux')) {
    const patchedSdp = description.sdp.replace(/^(m=audio [^\r\n]+)(?:\r?\n)/gm, '$1\r\na=rtcp-mux\r\n');
    if (patchedSdp !== description.sdp) {
      console.log('[SIP] Patched remote SDP to add a=rtcp-mux');
      if (description instanceof RTCSessionDescription) {
        description = new RTCSessionDescription({ type: description.type, sdp: patchedSdp });
      } else {
        description = { ...description, sdp: patchedSdp };
      }
    }
  }
  return originalSetRemoteDescription.call(this, description);
};

export type SipStatus = 'idle' | 'connecting' | 'connected' | 'registered' | 'disconnected' | 'error';

export interface ActiveCall {
  session: Session;
  direction: 'incoming' | 'outgoing';
  remoteIdentity: string;
  status: string;
  muted: boolean;
  speakerOn: boolean;
  startTime?: string;
  durationSeconds: number;
  remoteStream?: MediaStream;
}

function getPeerConnection(session: Session): RTCPeerConnection | undefined {
  const handler = (session as any).sessionDescriptionHandler;
  return handler?.peerConnection as RTCPeerConnection | undefined;
}

export function useSip() {
  const userAgentRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const registeredRef = useRef(false);
  const pendingCallTargetRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SipStatus>('idle');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sipSettings = useAppStore((s) => s.sipSettings);

  const timerRef = useRef<number | null>(null);
  const connectionTimeoutRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setActiveCall((prev) =>
        prev && prev.startTime
          ? { ...prev, durationSeconds: Math.floor((Date.now() - new Date(prev.startTime).getTime()) / 1000) }
          : prev
      );
    }, 1000);
  }, [stopTimer]);

  const handleSession = useCallback((session: Session, direction: 'incoming' | 'outgoing') => {
    const remoteIdentity = session.remoteIdentity?.uri?.toString?.() || 'Unknown';

    const clearConnectionTimeout = () => {
      if (connectionTimeoutRef.current) {
        window.clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };

    const updateRemoteStream = () => {
      const pc = getPeerConnection(session);
      if (!pc) return;
      const stream = new MediaStream();
      pc.getReceivers().forEach((receiver) => {
        if (receiver.track && receiver.track.readyState === 'live') {
          stream.addTrack(receiver.track);
        }
      });
      if (stream.getTracks().length > 0) {
        setActiveCall((prev) => (prev ? { ...prev, remoteStream: stream } : prev));
      }
      pc.ontrack = (event) => {
        setActiveCall((prev) => {
          if (!prev) return prev;
          const current = prev.remoteStream ? prev.remoteStream.clone() : new MediaStream();
          event.track && current.addTrack(event.track);
          return { ...prev, remoteStream: current };
        });
      };
    };

    setActiveCall({
      session,
      direction,
      remoteIdentity,
      status: direction === 'incoming' ? 'Ringing' : 'Calling',
      muted: false,
      speakerOn: true,
      durationSeconds: 0,
    });

    session.stateChange.addListener((newState: SessionState) => {
      if (newState === SessionState.Establishing) {
        setActiveCall((prev) => (prev ? { ...prev, status: 'Connecting' } : prev));
        clearConnectionTimeout();
        connectionTimeoutRef.current = window.setTimeout(() => {
          setError('Call timed out while connecting. The recipient may be offline.');
          try {
            session.bye();
          } catch {
            // ignore cleanup errors
          }
          setActiveCall(null);
        }, 30000);
      } else if (newState === SessionState.Established) {
        clearConnectionTimeout();
        updateRemoteStream();
        const startTime = new Date().toISOString();
        setActiveCall((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, status: 'In call', startTime };
          startTimer();
          return updated;
        });
      } else if (newState === SessionState.Terminated) {
        clearConnectionTimeout();
        stopTimer();
        setActiveCall(null);
      }
    });

    updateRemoteStream();
  }, [startTimer, stopTimer]);

  const callInternal = useCallback(
    async (target: string) => {
      if (!userAgentRef.current) {
        setError('SIP client not initialized');
        return;
      }
      if (!registeredRef.current) {
        setError('Not registered');
        return;
      }

      try {
        const normalized = normalizeTelnyxTarget(target);
        console.log('[SIP] Normalized call target:', normalized);
        const targetUri = UserAgent.makeURI(normalized);
        if (!targetUri) {
          throw new Error(`Invalid call target: ${normalized}`);
        }

        const inviter = new Inviter(userAgentRef.current, targetUri, {
          sessionDescriptionHandlerOptions: {
            constraints: { audio: true, video: false },
          },
        });

        handleSession(inviter, 'outgoing');
        await inviter.invite();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start call');
        setActiveCall(null);
        console.error('SIP call error:', err);
      }
    },
    [handleSession]
  );

  const register = useCallback(async (settings: SipSettings) => {
    try {
      setError(null);
      setStatus('connecting');
      registeredRef.current = false;

      const domain = 'sip.telnyx.com';
      const wsServer = 'wss://sip.telnyx.com:7443';
      const uriString = `sip:${settings.username}@${domain}`;
      const uri = UserAgent.makeURI(uriString);
      if (!uri) {
        throw new Error(`Invalid SIP URI: ${uriString}`);
      }

      const displayName = settings.phoneNumber ? settings.phoneNumber.replace(/[^0-9]/g, '') : 'User';

      const userAgentOptions: UserAgentOptions = {
        uri,
        transportOptions: {
          wsServers: [wsServer],
          connectionTimeout: 10000,
          reconnectionDelay: 3000,
          maxReconnectionAttempts: 3,
        },
        authorizationUsername: settings.username,
        authorizationPassword: settings.password,
        displayName,
        contactParams: {
          transport: 'ws',
        },
        delegate: {
          onInvite: (invitation: Invitation) => {
            console.log('Incoming SIP invite from', invitation.remoteIdentity.uri.toString());
            handleSession(invitation, 'incoming');
          },
          onConnect: () => {
            console.log('SIP transport connected');
            setStatus('connected');
          },
          onDisconnect: (err) => {
            console.log('SIP transport disconnected', err);
            setStatus('disconnected');
            registeredRef.current = false;
          },
        },
        sessionDescriptionHandlerFactoryOptions: {
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        },
      };

      const userAgent = new UserAgent(userAgentOptions);
      userAgentRef.current = userAgent;

      const registerer = new Registerer(userAgent);
      registererRef.current = registerer;
      registerer.stateChange.addListener((newState: RegistererState) => {
        if (newState === RegistererState.Registered) {
          setStatus('registered');
          registeredRef.current = true;
          const target = pendingCallTargetRef.current;
          pendingCallTargetRef.current = null;
          if (target) {
            window.setTimeout(() => {
              callInternal(target);
            }, 0);
          }
        } else if (newState === RegistererState.Unregistered) {
          setStatus('disconnected');
          registeredRef.current = false;
          pendingCallTargetRef.current = null;
        }
      });

      console.log('[SIP] Starting UserAgent with URI:', uriString);
      console.log('[SIP] WebSocket server:', wsServer);
      await userAgent.start();
      console.log('[SIP] Transport started, sending REGISTER...');
      await registerer.register();
      console.log('[SIP] REGISTER sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown SIP error');
      console.error('SIP registration error:', err);
    }
  }, [handleSession, callInternal]);

  const unregister = useCallback(async () => {
    try {
      if (registererRef.current) {
        await registererRef.current.unregister();
      }
      registeredRef.current = false;
    } catch (err) {
      console.error('SIP unregister error:', err);
    }
  }, []);

  const call = useCallback(
    async (target: string) => {
      const settings = useAppStore.getState().sipSettings;

      if (!settings) {
        setError('SIP credentials not configured. Open SIP Settings and enter your credentials.');
        return;
      }

      if (registeredRef.current && userAgentRef.current) {
        await callInternal(target);
        return;
      }

      if (status === 'connecting') {
        pendingCallTargetRef.current = target;
        return;
      }

      pendingCallTargetRef.current = target;
      await register(settings);
    },
    [callInternal, register, status]
  );

  const hangup = useCallback(() => {
    const session = activeCall?.session;
    if (!session) return;
    try {
      session.bye();
    } catch (err) {
      console.error('SIP hangup error:', err);
    }
    setActiveCall(null);
  }, [activeCall]);

  const toggleMute = useCallback(() => {
    const session = activeCall?.session;
    if (!session) return;
    const pc = getPeerConnection(session);
    if (!pc) return;
    const senders = pc.getSenders();
    const audioSender = senders.find((s) => s.track?.kind === 'audio');
    if (audioSender?.track) {
      audioSender.track.enabled = !audioSender.track.enabled;
      setActiveCall((prev) =>
        prev ? { ...prev, muted: !audioSender.track!.enabled } : prev
      );
    }
  }, [activeCall]);

  const toggleSpeaker = useCallback(() => {
    setActiveCall((prev) => (prev ? { ...prev, speakerOn: !prev.speakerOn } : prev));
  }, []);

  const acceptCall = useCallback(() => {
    const session = activeCall?.session;
    if (!session || activeCall?.direction !== 'incoming') return;
    if (session instanceof Invitation) {
      session
        .accept({
          sessionDescriptionHandlerOptions: {
            constraints: { audio: true, video: false },
          },
        })
        .catch((err: Error) => {
          console.error('Failed to accept invite:', err);
          setError(`Failed to answer: ${err.message}`);
          setActiveCall(null);
        });
    }
  }, [activeCall]);

  const rejectCall = useCallback(() => {
    const session = activeCall?.session;
    if (!session || activeCall?.direction !== 'incoming') return;
    if (session instanceof Invitation) {
      session.reject();
    }
    setActiveCall(null);
  }, [activeCall]);

  useEffect(() => {
    if (sipSettings && status === 'idle') {
      register(sipSettings);
    }
  }, [register, status, sipSettings]);

  useEffect(() => {
    return () => {
      stopTimer();
      if (connectionTimeoutRef.current) {
        window.clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      userAgentRef.current?.stop().catch((err) => console.error('SIP stop error:', err));
    };
  }, [stopTimer]);

  return {
    status,
    error,
    activeCall,
    register,
    unregister,
    call,
    hangup,
    toggleMute,
    toggleSpeaker,
    acceptCall,
    rejectCall,
  };
}

function normalizeTelnyxTarget(target: string): string {
  const trimmed = target.trim();
  if (trimmed.toLowerCase().startsWith('sip:')) {
    return trimmed;
  }
  if (trimmed.includes('@')) {
    return `sip:${trimmed}`;
  }
  const digits = trimmed.replace(/[^0-9+]/g, '');
  if (digits && /^\+?\d+$/.test(digits)) {
    return `sip:${digits}@sip.telnyx.com`;
  }
  // Treat as a SIP username for app-to-app calls.
  return `sip:${trimmed}@sip.telnyx.com`;
}
