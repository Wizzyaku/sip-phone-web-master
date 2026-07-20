import { useEffect, useRef } from 'react';
import { Bell, X, Phone, MessageSquare, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 3;

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  call: Phone,
  message: MessageSquare,
};

export function NotificationToast() {
  const notifications = useAppStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read);
  const visible = unread.slice(0, MAX_VISIBLE);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const dismiss = useAppStore((s) => s.dismissNotification);
  const timersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    for (const n of visible) {
      if (!timersRef.current[n.id]) {
        timersRef.current[n.id] = window.setTimeout(() => {
          dismiss(n.id);
          delete timersRef.current[n.id];
        }, AUTO_DISMISS_MS);
      }
    }
    return () => {
      for (const id of Object.keys(timersRef.current)) {
        if (!visible.some((n) => n.id === id)) {
          window.clearTimeout(timersRef.current[id]);
          delete timersRef.current[id];
        }
      }
    };
  }, [visible, dismiss]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-50 flex w-80 flex-col gap-2">
      {visible.map((n) => {
        const Icon = icons[n.type] || Bell;
        return (
          <div
            key={n.id}
            className={cn(
              'relative flex items-start gap-3 overflow-hidden rounded-lg border bg-card p-3 shadow-lg transition-all',
              n.type === 'call' && 'border-primary/50',
              n.type === 'message' && 'border-blue-400/50',
              n.type === 'warning' && 'border-yellow-400/50',
              n.type === 'error' && 'border-red-400/50'
            )}
          >
            <div className="mt-0.5">
              <Icon className={cn('h-5 w-5', n.type === 'call' && 'text-primary')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.body}</p>
            </div>
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markRead(n.id)}>
                <CheckCircle2 className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dismiss(n.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="absolute bottom-0 left-0 h-0.5 w-full bg-muted">
              <div
                className="h-full bg-primary transition-all ease-linear"
                style={{ animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards` }}
              />
            </div>
          </div>
        );
      })}
      <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
}
