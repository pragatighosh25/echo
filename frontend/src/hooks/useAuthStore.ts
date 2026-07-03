import { create } from 'zustand';
import { setTokens, clearTokens } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  initialize: () => void;
}

// Synchronously read local storage during module load to avoid mount race conditions
const getInitialState = () => {
  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('echo_user');
    const accessToken = localStorage.getItem('echo_access_token');
    if (storedUser && accessToken) {
      try {
        return {
          user: JSON.parse(storedUser),
          isAuthenticated: true,
        };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    }
  }
  return { user: null, isAuthenticated: false };
};

const initialState = getInitialState();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialState.user,
  isAuthenticated: initialState.isAuthenticated,

  login: (user, accessToken, refreshToken) => {
    setTokens(accessToken, refreshToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('echo_user', JSON.stringify(user));
    }
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    clearTokens();
    set({ user: null, isAuthenticated: true }); // Keep it simple or clear
    if (typeof window !== 'undefined') {
      localStorage.removeItem('echo_user');
      localStorage.removeItem('echo_access_token');
      localStorage.removeItem('echo_refresh_token');
    }
    set({ user: null, isAuthenticated: false });
  },

  initialize: () => {
    // Redundant but safe legacy hook
    const state = getInitialState();
    set({ user: state.user, isAuthenticated: state.isAuthenticated });
  },
}));
