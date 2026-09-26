import { z } from 'zod';
import { emailSchema } from '@/features/auth/schemas/register.schema';

export const createAdminInvitationSchema = z.strictObject({
    email: emailSchema,
});

export type CreateAdminInvitationPayload = z.infer<
    typeof createAdminInvitationSchema
>;
