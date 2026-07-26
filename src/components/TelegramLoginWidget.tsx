import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthUser) => void;
  }
}

export interface TelegramAuthUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface Props {
  botUsername: string;
  onAuth: (user: TelegramAuthUser) => void;
  size?: 'small' | 'medium' | 'large';
}

export function TelegramLoginWidget({ botUsername, onAuth, size = 'large' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    // Clear any existing widget
    containerRef.current.innerHTML = '';

    // Set up the global callback
    window.onTelegramAuth = (user: TelegramAuthUser) => {
      onAuth(user);
    };

    // Create the script element
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', size);
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.onload = () => setLoaded(true);

    containerRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [botUsername, onAuth, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="telegram-login-container" />
      {!loaded && (
        <div className="h-[44px] flex items-center text-[12px] text-slate-400">
          Loading Telegram login...
        </div>
      )}
    </div>
  );
}
