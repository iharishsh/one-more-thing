import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const code = error instanceof AuthError ? error.status : status;
  return NextResponse.json({ error: message }, { status: code });
}
