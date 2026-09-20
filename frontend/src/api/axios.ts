import axios from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { getToken, setToken, removeToken } from "@/utils/token";
import { ENDPOINTS } from "@/api/endpoints";
import type { ApiResponse, AuthData } from "@/types/api.types";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
    _retry?: boolean;
};

const BASE_AUTH_API_URL = import.meta.env.VITE_AUTH_API_BASE_URL;
if (!BASE_AUTH_API_URL) throw new Error("API_BASE_URL is not defined in env");

const refreshAccessToken = async (): Promise<string> => {
    const response = await axios.post<ApiResponse<AuthData>>(
        `${BASE_AUTH_API_URL}${ENDPOINTS.auth.refreshToken}`,
        {},
        {
            withCredentials: true,
            headers: {
                "Content-Type": "application/json",
            },
        },
    );

    const newToken = response.data.data?.accessToken;

    if (!newToken) {
        throw new Error("No access token returned from refresh");
    }

    return newToken;
};


// To handle multiple requests that fail due to an expired token, 
// we need to queue them up and retry them once the token is refreshed.
// This prevents multiple refresh requests from being sent simultaneously.
let isRefreshing = false;

let failedQueue: {
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}[] = [];

// If token refresh is successful, give the new token to all the failed requests in the queue.
// If token refresh fails, reject all the failed requests in the queue.
const processQueue = (error: unknown, token: string | null = null): void => {
    failedQueue.forEach((promise) => {
        if (error) {
            promise.reject(error);
        } else if (token) {
            promise.resolve(token);
        }
    });

    failedQueue = [];
};

// Create an Axios client for a particular microservice API, 
// with interceptors for handling token refresh and request retries.
const createApiClient = (baseURL: string): AxiosInstance => {
    if (!baseURL) throw new Error("API_BASE_URL is not defined in env");

    const api = axios.create({
        baseURL,
        withCredentials: true,
        headers: {
            "Content-Type": "application/json",
        },
    });

    // REQUEST INTERCEPTOR
    api.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            const token = getToken();
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error: unknown) => Promise.reject(error)
    );


    // RESPONSE INTERCEPTOR
    api.interceptors.response.use(
        (response: AxiosResponse) => response,
        async (error: unknown) => {
            if (!axios.isAxiosError(error) || !error.config) {
                return Promise.reject(error);
            }

            const originalRequest = error.config as RetryableRequestConfig;

            const status = error.response?.status;
            const requestUrl = originalRequest.url ?? "";

            // Skip token refresh for auth endpoints to avoid infinite loops
            const isAuthEndpoint =
                requestUrl.includes(ENDPOINTS.auth.login) ||
                requestUrl.includes(ENDPOINTS.auth.refreshToken) ||
                requestUrl.includes(ENDPOINTS.auth.logout);

            if (isAuthEndpoint) {
                return Promise.reject(error);
            }

            // Only refresh access token for 401 Unauthorized errors and if the request hasn't been retried yet
            if (status !== 401 || originalRequest._retry) {
                return Promise.reject(error);
            }

            // If the token is already being refreshed, queue the request
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({
                        resolve: (token: string) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            resolve(api(originalRequest));
                        },
                        reject,
                    });
                });
            }

            // Start the token refresh process
            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const newToken = await refreshAccessToken();

                setToken(newToken);
                processQueue(null, newToken);

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization =
                        `Bearer ${newToken}`;
                }

                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                removeToken();
                window.dispatchEvent(new Event("auth:logout"));
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
    );

    return api;
}

export default createApiClient;