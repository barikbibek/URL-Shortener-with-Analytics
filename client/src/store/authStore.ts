import { create } from "zustand";
import { authApi } from "@/lib/api";

interface User {
  id: string;
  email: string;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  isLoading: true,

  login: async (email, password) => {
    const data = await authApi.login(email, password);
    // Persist token to localStorage so it survives page refresh
    localStorage.setItem("token", data.token);
    set({ user: data.user, token: data.token });
  },

  register: async (email, password) => {
    const data = await authApi.register(email, password);
    localStorage.setItem("token", data.token);
    set({ user: data.user, token: data.token });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },

  // Called once on app startup (in App.tsx)
  // Verifies the stored token is still valid
  checkAuth: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const data = await authApi.me();
      set({ user: data.user, isLoading: false });
    } catch {
      // Token expired or invalid — clear it
      localStorage.removeItem("token");
      set({ user: null, token: null, isLoading: false });
    }
  },
}));