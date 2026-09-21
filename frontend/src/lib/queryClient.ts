import { parseError } from "@/utils/errorHandler";
import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";

const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error) => {
            return parseError(error);
        },
    }),
    mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
            mutation.meta;
            return parseError(error);
        },
    }),
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