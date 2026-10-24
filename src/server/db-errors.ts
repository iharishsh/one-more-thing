import { Prisma } from "@/generated/prisma/client";

/** A unique index rejected the write (e.g. another instance already drafted it). */
export function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
