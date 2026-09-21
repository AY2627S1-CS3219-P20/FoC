import {
    createContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from "react";
import { setToken, removeToken } from "@/utils/token";
import useAuthStore from "@/store/authStore";
import type { ApiResponse, AuthData } from "@/types/api.types";
import { ENDPOINTS } from "@/api/endpoints";
import authApi from "@/api/authApi";

interface AuthContextValue {
    isInitializing: boolean;
    restoreSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
    isInitializing: false,
    restoreSession: async () => { },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isInitializing, setIsInitializing] = useState(false);
    const setUser = useAuthStore((state) => state.setUser);
    const clearAuth = useAuthStore((state) => state.clearAuth);

    const restoreSession = useCallback(async () => {
        setIsInitializing(true);
        try {
            const response = await authApi.post<ApiResponse<AuthData>>(ENDPOINTS.auth.refreshToken);
            const { accessToken, user } = response.data.data!;
            setToken(accessToken);
            setUser(user);
        } catch {
            removeToken();
            clearAuth();
        } finally {
            setIsInitializing(false);
        }
    }, [setUser, clearAuth]);

    useEffect(() => {
        const forcedLogout = () => {
            removeToken();
            clearAuth();
        };
        // Listen for the "auth:logout" event from axios interceptor to handle forced logout across tabs
        window.addEventListener("auth:logout", forcedLogout);
        return () => window.removeEventListener("auth:logout", forcedLogout);
    }, [clearAuth]);

    return (
        <AuthContext.Provider value={{ isInitializing, restoreSession }}>
            {children}
        </AuthContext.Provider>
    );
};