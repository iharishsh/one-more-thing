"use client";

import { useEffect, useState } from "react";
import { WorkspaceGhost } from "@/components/workspace-ghost";

export const HANDOFF_BRIDGE_SHOW = "omt:handoff-bridge-show";
export const HANDOFF_BRIDGE_HIDE = "omt:handoff-bridge-hide";

/** Call from the auth exit sequence — must stay inside the App Router tree. */
export function showHandoffBridge() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HANDOFF_BRIDGE_SHOW));
}

export function hideHandoffBridge() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HANDOFF_BRIDGE_HIDE));
}

/**
 * Mounted in the root layout so WorkspaceGhost/AppHeader keep router context.
 * Covers the brief gap between MarketingFrame unmount and workspace paint.
 */
export function AuthHandoffBridge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let safety = 0;

    function show() {
      setVisible(true);
      window.clearTimeout(safety);
      safety = window.setTimeout(() => setVisible(false), 6000);
    }

    function hide() {
      window.clearTimeout(safety);
      safety = 0;
      setVisible(false);
    }

    window.addEventListener(HANDOFF_BRIDGE_SHOW, show);
    window.addEventListener(HANDOFF_BRIDGE_HIDE, hide);
    return () => {
      window.clearTimeout(safety);
      window.removeEventListener(HANDOFF_BRIDGE_SHOW, show);
      window.removeEventListener(HANDOFF_BRIDGE_HIDE, hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-background">
      <WorkspaceGhost />
    </div>
  );
}
