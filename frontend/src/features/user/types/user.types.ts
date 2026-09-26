import type { ApiUser } from '@/features/auth/types/auth.types';

export interface EmailChangeChallenge {
    challengeId: string;
    expiresAt: string;
}

export interface PendingEmailChange extends EmailChangeChallenge {
    email: string;
}

export interface ProfileResult {
    user: ApiUser;
    pendingEmailChange: PendingEmailChange | null;
}

export interface EmailChangeVerificationResult {
    user: ApiUser;
}
