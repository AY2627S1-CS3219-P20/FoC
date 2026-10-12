import { z } from "zod";
import creditApi from "@/api/creditApi";
import { ENDPOINTS } from "@/api/endpoints";
import type { CreditBalance } from "../types/credit.types";

const balanceSchema = z.discriminatedUnion("status", [
    z.object({ status: z.literal("PROVISIONING") }),
    z.object({
        status: z.literal("READY"),
        availableCredits: z.number().int().nonnegative(),
        reservedCredits: z.number().int().nonnegative(),
        updatedAt: z.iso.datetime(),
    }),
]) satisfies z.ZodType<CreditBalance>;

const balanceResponseSchema = z.object({
    success: z.literal(true),
    data: balanceSchema,
});

export const getCreditBalanceService = async (
    signal?: AbortSignal,
): Promise<CreditBalance> => {
    const response = await creditApi.get<unknown>(ENDPOINTS.credit.balance, { signal });
    const result = balanceResponseSchema.safeParse(response.data);

    if (!result.success) {
        throw new Error("Invalid credit balance response");
    }

    return result.data.data;
};
