import { useNavigate } from 'react-router-dom';
import { Wallet, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface LowBalanceModalProps {
  open: boolean;
  onClose: () => void;
  action?: 'call' | 'message';
}

export function LowBalanceModal({ open, onClose, action = 'call' }: LowBalanceModalProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const actionLabel = action === 'message' ? 'send a message' : 'make a call';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-sm border-border bg-background shadow-2xl">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Insufficient Balance</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your balance is too low to {actionLabel}. Buy more credits to continue.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => {
                onClose();
                navigate('/billing');
              }}
            >
              Buy Credit
            </Button>
            <Button variant="outline" className="w-full" onClick={onClose}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
