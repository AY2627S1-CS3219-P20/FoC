import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ROUTES } from "@/routes/routes";
import { parseError, type ParsedError } from "@/utils/errorHandler";
import { verifyRegistrationService } from "../services/auth.service";
import type { VerifyRegistrationPayload } from "../schemas/register.schema";
import type { VerifyRegistrationResult } from "../types/auth.types";

const useVerifyRegistration = () => {
  const navigate = useNavigate();
  const { mutate, isPending, isError, error } = useMutation<
    VerifyRegistrationResult,
    ParsedError,
    VerifyRegistrationPayload
  >({
    mutationFn: async (payload) => {
      try {
        return await verifyRegistrationService(payload);
      } catch (rawError) {
        throw parseError(rawError);
      }
    },
    onSuccess: () => {
      toast.success("Account created successfully. Please log in.");
      navigate(ROUTES.LOGIN, { replace: true });
    },
    onError: (verificationError) => {
      toast.error(verificationError.message);
    },
  });

  return {
    verifyRegistration: mutate,
    isPending,
    isError,
    error,
  };
};

export default useVerifyRegistration;
