import { useQuery } from "@tanstack/react-query";
import { ROLES } from "@/features/auth/types/auth.types";
import useAuth from "@/hooks/useAuth";
import { parseError, type ParsedError } from "@/utils/errorHandler";
import { creditKeys } from "../credit.keys";
import { getCreditTransactionsService } from "../services/credit.service";
import type { CreditTransactionParams, CreditTransactions } from "../types/credit.types";

const useCreditTransactions = (params: CreditTransactionParams) => {
    const { user, isAuthenticated, isInitializing } = useAuth();
    const isEligible = !isInitializing && isAuthenticated
        && user?.role === ROLES.STUDENT && !!user.id;

    const query = useQuery<CreditTransactions, ParsedError>({
        queryKey: creditKeys.transactionPage(user?.id ?? "", params),
        enabled: isEligible,
        queryFn: async ({ signal }) => {
            try {
                return await getCreditTransactionsService(params, signal);
            } catch (error) {
                throw parseError(error);
            }
        },
        staleTime: 30_000,
        retry: false,
        // History is a live cursor view. Refresh explicitly to return to its start.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const retry = async () => {
        if (isEligible && query.fetchStatus === "idle") await query.refetch();
    };

    return { ...query, isEligible, retry };
};

export default useCreditTransactions;
