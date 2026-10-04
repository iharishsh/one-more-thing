"use client";

import { useEffect } from "react";
import { hideHandoffBridge } from "@/components/auth-handoff-bridge";
import { consumeFromAuthTransition } from "@/lib/auth-exit";

/** Clears handoff flag + bridge after the real workspace page has mounted. */
export function AuthTransitionSettler() {
  useEffect(() => {
    consumeFromAuthTransition();
    // Let the real page paint under the bridge for a frame, then lift it.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => hideHandoffBridge());
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}
