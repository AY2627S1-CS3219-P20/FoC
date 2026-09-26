import { randomInt } from "node:crypto";
import argon2 from "argon2";
import {
  REGISTRATION_OTP_EXPIRES_IN_MINUTES,
  REGISTRATION_OTP_MAX_REQUESTS_PER_HOUR,
} from "../constants/auth.constants.js";
import { AppError } from "../errors/errors.js";
import {
  Prisma,
  type PendingRegistration,
} from "../generated/prisma/client.js";
import { sendRegistrationOtpEmail } from "../libs/email.js";
import { prisma } from "../libs/prisma.js";
import type {
  RegisterInput,
  ResendRegistrationOtpInput,
} from "../schemas/register.schema.js";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const OTP_MIN = 100_000;
const OTP_MAX = 1_000_000;
const TRANSACTION_ATTEMPTS = 2;

type OtpRequest =
  | {
      kind: "initial";
      input: RegisterInput;
      passwordHash: string;
    }
  | {
      kind: "resend";
      pending: PendingRegistration;
    };

async function ensureIdentityIsAvailable(
  identity: Pick<RegisterInput, "email" | "username" | "phoneNumber">,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identity.email },
        { username: identity.username },
        { phoneNumber: identity.phoneNumber },
      ],
    },
    select: {
      email: true,
      username: true,
      phoneNumber: true,
    },
  });

  if (!user) {
    return;
  }

  if (user.email === identity.email) {
    throw new AppError("Email is already registered", 409, "EMAIL_ALREADY_REGISTERED");
  }

  if (user.username === identity.username) {
    throw new AppError("Username is already taken", 409, "USERNAME_TAKEN");
  }

  throw new AppError("Phone number is already registered", 409, "PHONE_NUMBER_TAKEN");
}

function isTransactionConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2034";
}

async function saveOtpRequest(
  request: OtpRequest,
  otpHash: string,
  expiresAt: Date,
): Promise<PendingRegistration> {
  const email = request.kind === "initial"
    ? request.input.email
    : request.pending.email;
  const windowStart = new Date(Date.now() - ONE_HOUR_IN_MS);

  for (let attempt = 1; attempt <= TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const requestCount = await tx.registrationOtpRequest.count({
          where: {
            email,
            requestedAt: { gte: windowStart },
          },
        });

        if (requestCount >= REGISTRATION_OTP_MAX_REQUESTS_PER_HOUR) {
          throw new AppError(
            "Too many verification codes requested. Please try again later.",
            429,
            "OTP_REQUEST_LIMIT_EXCEEDED",
          );
        }

        const pending = request.kind === "initial"
          ? await tx.pendingRegistration.upsert({
              where: { email },
              create: {
                email,
                username: request.input.username,
                phoneNumber: request.input.phoneNumber,
                passwordHash: request.passwordHash,
                otpHash,
                expiresAt,
              },
              update: {
                username: request.input.username,
                phoneNumber: request.input.phoneNumber,
                passwordHash: request.passwordHash,
                otpHash,
                expiresAt,
                failedAttempts: 0,
                emailSentAt: null,
                consumedAt: null,
              },
            })
          : await tx.pendingRegistration.update({
              where: {
                challengeId: request.pending.challengeId,
                consumedAt: null,
              },
              data: {
                otpHash,
                expiresAt,
                failedAttempts: 0,
                emailSentAt: null,
              },
            });

        await tx.registrationOtpRequest.create({
          data: { email },
        });

        return pending;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isTransactionConflict(error) || attempt === TRANSACTION_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new AppError("Unable to issue verification code", 500);
}

async function issueOtp(request: OtpRequest) {
  const email = request.kind === "initial"
    ? request.input.email
    : request.pending.email;
  const otp = randomInt(OTP_MIN, OTP_MAX).toString();
  const otpHash = await argon2.hash(otp);
  const expiresAt = new Date(
    Date.now() + REGISTRATION_OTP_EXPIRES_IN_MINUTES * 60 * 1000,
  );
  const pending = await saveOtpRequest(request, otpHash, expiresAt);

  await sendRegistrationOtpEmail(email, otp);

  await prisma.pendingRegistration.updateMany({
    where: {
      challengeId: pending.challengeId,
      otpHash,
      consumedAt: null,
    },
    data: { emailSentAt: new Date() },
  });

  return {
    challengeId: pending.challengeId,
    expiresAt,
  };
}

export async function startRegistration(input: RegisterInput) {
  await ensureIdentityIsAvailable(input);
  const passwordHash = await argon2.hash(input.password);

  return issueOtp({
    kind: "initial",
    input,
    passwordHash,
  });
}

export async function resendRegistrationOtp(
  input: ResendRegistrationOtpInput,
) {
  const pending = await prisma.pendingRegistration.findUnique({
    where: { challengeId: input.challengeId },
  });

  if (!pending || pending.consumedAt || !pending.passwordHash) {
    throw new AppError(
      "Registration request is no longer active",
      409,
      "REGISTRATION_NOT_ACTIVE",
    );
  }

  await ensureIdentityIsAvailable(pending);

  return issueOtp({ kind: "resend", pending });
}
