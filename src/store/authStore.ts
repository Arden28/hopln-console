import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiService } from "@/api/client";
import type { ConsoleUser } from "@/types";

interface AuthState {
  user: ConsoleUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: ConsoleUser, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        apiService.setToken(token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        apiService.removeToken();
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: "hopln:console:auth",
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
