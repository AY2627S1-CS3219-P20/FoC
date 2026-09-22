import { parseError } from "@/utils/errorHandler";
import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (failureCount, error) => {
                const { statusCode } = parseError(error);
                if (statusCode >= 400 && statusCode < 500) return false;
                return failureCount < 2;
            },
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: false,
        },
    }
});

export default queryClient;