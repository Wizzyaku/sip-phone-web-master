import { create } from 'zustand';

export type AuthMode = 'login' | 'signup';
export type AuthStep = 'form' | 'otp';

interface AuthModalState {
  isOpen: boolean;
  mode: AuthMode;
  step: AuthStep;
  email: string;
  open: (mode?: AuthMode) => void;
  close: () => void;
  setMode: (mode: AuthMode) => void;
  setStep: (step: AuthStep) => void;
  setEmail: (email: string) => void;
  reset: () => void;
}

export const useAuthModal = create<AuthModalState>((set) => ({
  isOpen: false,
  mode: 'login',
  step: 'form',
  email: '',
  open: (mode = 'login') => set({ isOpen: true, mode, step: 'form', email: '' }),
  close: () => set({ isOpen: false, step: 'form', email: '' }),
  setMode: (mode) => set({ mode, step: 'form' }),
  setStep: (step) => set({ step }),
  setEmail: (email) => set({ email }),
  reset: () => set({ isOpen: false, mode: 'login', step: 'form', email: '' }),
}));
