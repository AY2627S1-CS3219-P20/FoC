import type { ApiUser } from "@/types/api.types";
import { create } from "zustand";

interface AuthState {
    user: ApiUser | null;
    isAuthenticated: boolean;

    setUser: (user: ApiUser) => void;
    clearAuth: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,

    setUser: (user: ApiUser) => set({ user, isAuthenticated: true }),
    clearAuth: () => set({ user: null, isAuthenticated: false }),
}));

export default useAuthStore;
