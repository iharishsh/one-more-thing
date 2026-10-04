"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { showHandoffBridge } from "@/components/auth-handoff-bridge";
import { AppHeader } from "@/components/app-header";
import { Spinner } from "@/components/spinner";
import { WorkspaceGhost } from "@/components/workspace-ghost";
import {
  AUTH_EXIT_EVENT,
  AUTH_PENDING_EVENT,
  type AuthBusyMode,
  markFromAuthTransition,
} from "@/lib/auth-exit";
import { cn } from "@/lib/utils";

type BandStage =
  | "hidden"
  | "home"
  | "auth"
  | "exit-line"
  | "exit-split";

type CardMode = "form" | "workspace-loading" | "empty";

const FROM_HOME_KEY = "omt-band-from-home";

function authPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}

function isAuthHref(href: string | null) {
  if (!href) return false;
  try {
    const url = new URL(href, window.location.origin);
    return authPath(url.pathname);
  } catch {
    return false;
  }
}

function readFromHomeFlag() {
  try {
    return sessionStorage.getItem(FROM_HOME_KEY) === "1";
  } catch {
    return false;
  }
}

function markFromHomeFlag() {
  try {
    sessionStorage.setItem(FROM_HOME_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearFromHomeFlag() {
  try {
    sessionStorage.removeItem(FROM_HOME_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Shared marketing shell: blue band on home → auth card → workspace handoff
 * (load in-card, rise to header line, split away while workspace slides up).
 */
export function MarketingFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuth = authPath(pathname);
  // SSR-safe defaults only — session flags applied after mount.
  const [stage, setStage] = useState<BandStage>(() =>
    isAuth ? "auth" : "hidden",
  );
  const [formVisible, setFormVisible] = useState(isAuth);
  const [cardMode, setCardMode] = useState<CardMode>("form");
  const [authBusy, setAuthBusy] = useState<AuthBusyMode>(null);
  const [workspaceIncoming, setWorkspaceIncoming] = useState(false);
  const [workspaceIn, setWorkspaceIn] = useState(false);
  const [headerMode, setHeaderMode] = useState<"marketing" | "app">(
    "marketing",
  );
  const wasAuth = useRef(isAuth);
  const exiting = stage === "exit-line" || stage === "exit-split";
  const handoff = cardMode !== "form" || workspaceIncoming || exiting;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      if (authPath(window.location.pathname)) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      if (isAuthHref(anchor.getAttribute("href"))) {
        markFromHomeFlag();
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  // Apply from-home flag after mount (avoids SSR/client markup mismatch).
  useEffect(() => {
    if (!isAuth || !readFromHomeFlag()) return;
    setFormVisible(false);
    setStage("home");
    const raf1 = requestAnimationFrame(() => {
      void document.body.offsetHeight;
      requestAnimationFrame(() => {
        clearFromHomeFlag();
        setStage("auth");
        window.setTimeout(() => setFormVisible(true), 360);
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, [isAuth]);

  useEffect(() => {
    function onPending(event: Event) {
      const mode =
        (event as CustomEvent<{ mode: AuthBusyMode }>).detail?.mode ?? null;
      setAuthBusy(mode);
    }
    window.addEventListener(AUTH_PENDING_EVENT, onPending);
    return () => window.removeEventListener(AUTH_PENDING_EVENT, onPending);
  }, []);

  // Auth success → load workspace in-card → rise/split + workspace slide-up.
  useEffect(() => {
    const timers: number[] = [];

    function onAuthExit(event: Event) {
      const detail = (event as CustomEvent<{ href: string; done: () => void }>)
        .detail;
      const done = detail?.done ?? (() => undefined);
      const href = detail?.href || "/workspace";

      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;

      setAuthBusy(null);
      setCardMode("workspace-loading");
      setFormVisible(true);
      setStage("auth");
      router.prefetch(href);

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const startMorph = () => {
        setFormVisible(false);
        setCardMode("empty");
        setHeaderMode("app");
        setWorkspaceIncoming(true);
        // Paint the off-screen workspace panel, then slide it in with the band.
        timers.push(
          window.setTimeout(() => {
            void document.body.offsetHeight;
            setWorkspaceIn(true);
            setStage("exit-line");
            timers.push(
              window.setTimeout(() => setStage("exit-split"), reduced ? 40 : 560),
            );
            timers.push(
              window.setTimeout(
                () => {
                  markFromAuthTransition();
                  // Cover the route swap before MarketingFrame unmounts.
                  showHandoffBridge();
                  done();
                },
                reduced ? 120 : 560 + 560,
              ),
            );
          }, reduced ? 30 : 40),
        );
      };

      // Hold the in-card "Loading workspace…" beat, then morph.
      timers.push(window.setTimeout(startMorph, reduced ? 120 : 900));
    }

    window.addEventListener(AUTH_EXIT_EVENT, onAuthExit);
    return () => {
      for (const id of timers) window.clearTimeout(id);
      window.removeEventListener(AUTH_EXIT_EVENT, onAuthExit);
    };
  }, [router]);

  useEffect(() => {
    if (isAuth || stage !== "hidden" || handoff) return;
    const id = requestAnimationFrame(() => setStage("home"));
    return () => cancelAnimationFrame(id);
  }, [isAuth, stage, handoff]);

  useLayoutEffect(() => {
    if (handoff) return;

    const leavingAuth = wasAuth.current && !isAuth;
    const enteringAuth = !wasAuth.current && isAuth;
    wasAuth.current = isAuth;

    if (leavingAuth) {
      clearFromHomeFlag();
      setFormVisible(false);
      setCardMode("form");
      setStage("home");
      setAuthBusy(null);
      setHeaderMode("marketing");
      setWorkspaceIncoming(false);
      setWorkspaceIn(false);
      return;
    }

    if (enteringAuth) {
      setFormVisible(false);
      setCardMode("form");
      setStage("home");

      let formTimer = 0;
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        void document.body.offsetHeight;
        raf2 = requestAnimationFrame(() => {
          clearFromHomeFlag();
          setStage("auth");
          formTimer = window.setTimeout(() => setFormVisible(true), 360);
        });
      });

      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        window.clearTimeout(formTimer);
      };
    }

    if (isAuth) {
      clearFromHomeFlag();
      setStage("auth");
      setCardMode("form");
      setFormVisible(true);
    }
  }, [isAuth, handoff]);

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-white">
      <AppHeader
        variant={headerMode}
        authBusy={headerMode === "marketing" ? authBusy : null}
        className={cn(
          "z-30 transition-colors duration-500",
          headerMode === "marketing" &&
            (exiting || workspaceIncoming
              ? "border-border"
              : "border-transparent"),
        )}
      />

      <div
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col transition-opacity duration-300",
          isAuth || handoff ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {!isAuth && !handoff ? children : null}
      </div>

      {workspaceIncoming ? (
        <div
          className={cn(
            "marketing-workspace-incoming absolute inset-x-0 bottom-0 z-[15] overflow-y-auto bg-[color:var(--background)]",
            workspaceIn && "is-in",
          )}
          aria-hidden
        >
          {/* Header already rendered above as app chrome — body only here. */}
          <WorkspaceGhost includeHeader={false} />
        </div>
      ) : null}

      <div
        data-stage={stage}
        className="marketing-band absolute left-1/2 z-20 bg-[color:var(--brand-accent)]"
        aria-hidden={exiting || undefined}
      >
        {isAuth && stage === "auth" && cardMode !== "empty" ? (
          <div
            key={`${pathname}-${cardMode}`}
            className={cn(
              "marketing-auth-form rounded-[28px] bg-white p-6 shadow-sm md:p-8",
              formVisible && "is-visible",
            )}
          >
            {cardMode === "workspace-loading" ? (
              <div
                className="flex flex-col items-center justify-center gap-3 py-10 text-center"
                role="status"
                aria-live="polite"
              >
                <Spinner
                  className="size-6 text-[color:var(--brand)]"
                  label="Loading workspace"
                />
                <p className="text-heading text-xl">Loading workspace…</p>
                <p className="text-sm text-muted-foreground">
                  Pulling in your projects and open requests.
                </p>
              </div>
            ) : (
              children
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
