import {
    createContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
    useRef,
} from "react";
import { setToken, removeToken } from "@/utils/token";
import useAuthStore from "@/store/authStore";
import type { ApiResponse } from "@/types/api.types";
import { ENDPOINTS } from "@/api/endpoints";
import authApi from "@/api/authApi";
import type { AuthResult } from "@/features/auth/types/auth.types";
import { toast } from "react-toastify";

interface AuthContextValue {
    isInitializing: boolean;
    restoreSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
    isInitializing: false,
    restoreSession: async () => { },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [isInitializing, setIsInitializing] = useState(true);
    const setUser = useAuthStore((state) => state.setUser);
    const clearAuth = useAuthStore((state) => state.clearAuth);

    // Use a ref to store the promise of the restoreSession function,
    // to ensure that multiple calls to restoreSession do not trigger multiple requests.
    const restorePromiseRef = useRef<Promise<void> | null>(null);

    const restoreSession = useCallback(async () => {
        if (restorePromiseRef.current) {
            return restorePromiseRef.current;
        }

        const promise = (async () => {
            setIsInitializing(true);

            try {
                // console.log("REFRESH: starting");

                const response = await authApi.post<ApiResponse<AuthResult>>(ENDPOINTS.auth.refreshToken);
                // console.log("REFRESH: success", response.data);

                const { accessToken, user } = response.data.data!;
                // console.log("REFRESH: user =", user);

                setToken(accessToken);
                setUser(user);
                // console.log("REFRESH: setUser called");

            } catch (error) {
                // console.error("REFRESH: FAILED", error);
                removeToken();
                clearAuth();
            } finally {
                setIsInitializing(false);
                restorePromiseRef.current = null;
                // console.log("REFRESH: initialization finished");
            }
        })();

        restorePromiseRef.current = promise;

        return promise;
    }, [setUser, clearAuth]);

    // Restore session when the app starts or when the user refreshes the page
    useEffect(() => {
        void restoreSession();
    }, [restoreSession]);

    useEffect(() => {
        const forcedLogout = () => {
            removeToken();
            clearAuth();
            toast.error("Your session has expired. Please log in again.", {
                toastId: "session-expired",
            });
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