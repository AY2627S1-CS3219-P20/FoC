import { Prisma, type Role } from "../generated/prisma/client.js";
import { AppError } from "../errors/errors.js";
import { prisma } from "../libs/prisma.js";
import type { UpdateMyProfileInput } from "../schemas/user.schema.js";

const publicUserSelect = {
  userId: true,
  email: true,
  username: true,
  phoneNumber: true,
  role: true,
} as const;

function toPublicUser(user: {
  userId: string;
  email: string;
  username: string;
  phoneNumber: string;
  role: Role;
}) {
  return {
    id: user.userId,
    email: user.email,
    username: user.username,
    phoneNumber: user.phoneNumber,
    role: user.role,
  };
}

async function ensureProfileValuesAreAvailable(
  userId: string,
  input: UpdateMyProfileInput,
) {
  const conflicts = await prisma.user.findFirst({
    where: {
      userId: { not: userId },
      OR: [
        ...(input.username ? [{ username: input.username }] : []),
        ...(input.phoneNumber ? [{ phoneNumber: input.phoneNumber }] : []),
      ],
    },
    select: {
      username: true,
      phoneNumber: true,
    },
  });

  if (conflicts?.username === input.username) {
    throw new AppError("Username is already taken", 409, "USERNAME_TAKEN");
  }

  if (conflicts?.phoneNumber === input.phoneNumber) {
    throw new AppError(
      "Phone number is already registered",
      409,
      "PHONE_NUMBER_TAKEN",
    );
  }
}

export async function getMyProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: publicUserSelect,
  });

  if (!user) {
    throw new AppError("User account not found", 404, "USER_NOT_FOUND");
  }

  return toPublicUser(user);
}

export async function updateMyProfile(
  userId: string,
  input: UpdateMyProfileInput,
) {
  await ensureProfileValuesAreAvailable(userId, input);

  const data: Prisma.UserUpdateInput = {};

  if (input.username !== undefined) {
    data.username = input.username;
  }

  if (input.phoneNumber !== undefined) {
    data.phoneNumber = input.phoneNumber;
  }

  try {
    const user = await prisma.user.update({
      where: { userId },
      data,
      select: publicUserSelect,
    });

    return toPublicUser(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2025"
    ) {
      throw new AppError("User account not found", 404, "USER_NOT_FOUND");
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) {
      await ensureProfileValuesAreAvailable(userId, input);
      throw new AppError("Profile details are already in use", 409, "PROFILE_CONFLICT");
    }

    throw error;
  }
}
