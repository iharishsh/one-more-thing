"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { showHandoffBridge } from "@/components/auth-handoff-bridge";
import { AppHeader } from "@/components/app-header";
import { MarketingProductStory } from "@/components/marketing-product-story";
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

type SeedRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const FROM_HOME_KEY = "omt-band-from-home";
const STORY_SLIDE_MS = 420;

function authPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}

function isWorkspacePath(pathname: string) {
  return pathname === "/workspace" || pathname.startsWith("/workspace/");
}

function isLeaveHomeHref(href: string | null) {
  if (!href) return false;
  try {
    const url = new URL(href, window.location.origin);
    return authPath(url.pathname) || isWorkspacePath(url.pathname);
  } catch {
    return false;
  }
}

/** Rough client check — enough to avoid /workspace → middleware → /login remount jank. */
function hasClientSession() {
  try {
    const cookies = document.cookie.split(";").map((part) => part.trim());
    if (cookies.some((part) => part.startsWith("omt_demo_user="))) return true;
    return cookies.some(
      (part) => part.startsWith("sb-") || part.includes("-auth-token"),
    );
  } catch {
    return false;
  }
}

/**
 * Keep leave-home navigations inside the marketing layout when possible so the
 * seeded blue-band morph stays mounted (Log In / Sign Up path).
 */
function resolveLeaveHomeHref(href: string) {
  const url = new URL(href, window.location.origin);
  if (authPath(url.pathname)) {
    return `${url.pathname}${url.search}`;
  }
  if (isWorkspacePath(url.pathname) && !hasClientSession()) {
    const next = `${url.pathname}${url.search}`;
    return `/login?next=${encodeURIComponent(next)}`;
  }
  return `${url.pathname}${url.search}`;
}

function clearFromHomeFlag() {
  try {
    sessionStorage.removeItem(FROM_HOME_KEY);
  } catch {
    /* ignore */
  }
}

function markFromHomeFlag() {
  try {
    sessionStorage.setItem(FROM_HOME_KEY, "1");
  } catch {
    /* ignore */
  }
}

function seedStyleFromRect(rect: SeedRect, frozen: boolean): CSSProperties {
  return {
    top: rect.top,
    left: rect.left + rect.width / 2,
    width: rect.width,
    height: rect.height,
    maxHeight: "none",
    padding: 0,
    borderRadius: "36px 36px 0 0",
    transform: "translate3d(-50%, 0, 0)",
    ...(frozen ? { transition: "none" } : null),
  };
}

/**
 * Shared marketing shell: blue band on home → auth card → workspace handoff.
 */
export function MarketingFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuth = authPath(pathname);
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
  const [storyExit, setStoryExit] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  /** Absolute band seeded from the in-flow band’s last rect (no teleport). */
  const [seedRect, setSeedRect] = useState<SeedRect | null>(null);
  const [seedFrozen, setSeedFrozen] = useState(false);
  const [bridging, setBridging] = useState(false);
  const wasAuth = useRef(isAuth);
  const navLock = useRef(false);
  const morphingIn = useRef(false);
  const seedRectRef = useRef<SeedRect | null>(null);
  const flowBandRef = useRef<HTMLDivElement>(null);
  const absoluteBandRef = useRef<HTMLDivElement>(null);
  const exiting = stage === "exit-line" || stage === "exit-split";
  const handoff = cardMode !== "form" || workspaceIncoming || exiting;
  const homeMode = !isAuth && !handoff && !bridging;

  function applySeedRect(next: SeedRect | null, frozen = true) {
    seedRectRef.current = next;
    setSeedRect(next);
    setSeedFrozen(frozen);
  }

  // Delay leaving home until the white preview has slid down.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (authPath(window.location.pathname)) return;
      if (navLock.current || pendingHref || bridging) return;

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const hrefAttr = anchor.getAttribute("href");
      if (!isLeaveHomeHref(hrefAttr)) return;

      event.preventDefault();
      event.stopPropagation();

      const next = resolveLeaveHomeHref(hrefAttr!);
      if (authPath(new URL(next, window.location.origin).pathname)) {
        markFromHomeFlag();
      }

      navLock.current = true;
      setStoryExit(true);
      setPendingHref(next);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pendingHref, bridging]);

  useEffect(() => {
    if (!pendingHref || !storyExit) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 40 : STORY_SLIDE_MS;

    const id = window.setTimeout(() => {
      const href = pendingHref;
      setPendingHref(null);

      const target = new URL(href, window.location.origin);
      const goingAuth = authPath(target.pathname);
      const flow = flowBandRef.current;

      // Seed only for in-layout auth morph. Workspace (signed-in) leaves the
      // marketing shell after the story slide — no blue center morph there.
      if (goingAuth && flow) {
        const r = flow.getBoundingClientRect();
        flushSync(() => {
          applySeedRect(
            {
              top: r.top,
              left: r.left,
              width: r.width,
              height: r.height,
            },
            true,
          );
          setBridging(true);
          setStage("home");
        });
      }

      router.push(href);
      window.setTimeout(() => {
        navLock.current = false;
      }, 100);
    }, delay);

    return () => window.clearTimeout(id);
  }, [pendingHref, storyExit, router]);

  useEffect(() => {
    function onPending(event: Event) {
      const mode =
        (event as CustomEvent<{ mode: AuthBusyMode }>).detail?.mode ?? null;
      setAuthBusy(mode);
    }
    window.addEventListener(AUTH_PENDING_EVENT, onPending);
    return () => window.removeEventListener(AUTH_PENDING_EVENT, onPending);
  }, []);

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
      setStoryExit(false);
      applySeedRect(null, false);
      setBridging(false);
      morphingIn.current = false;
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
                  showHandoffBridge();
                  done();
                },
                reduced ? 120 : 560 + 560,
              ),
            );
          }, reduced ? 30 : 40),
        );
      };

      timers.push(window.setTimeout(startMorph, reduced ? 120 : 900));
    }

    window.addEventListener(AUTH_EXIT_EVENT, onAuthExit);
    return () => {
      for (const id of timers) window.clearTimeout(id);
      window.removeEventListener(AUTH_EXIT_EVENT, onAuthExit);
    };
  }, [router]);

  useEffect(() => {
    if (isAuth || stage !== "hidden" || handoff || bridging) return;
    const id = requestAnimationFrame(() => {
      setStage("home");
      setStoryExit(false);
    });
    return () => cancelAnimationFrame(id);
  }, [isAuth, stage, handoff, bridging]);

  // After delayed push lands on auth: morph seeded band → center.
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
      setStoryExit(false);
      setPendingHref(null);
      applySeedRect(null, false);
      setBridging(false);
      morphingIn.current = false;
      navLock.current = false;
      return;
    }

    if (enteringAuth) {
      setFormVisible(false);
      setCardMode("form");
      setStoryExit(false);
      morphingIn.current = true;

      const seeded = seedRectRef.current;

      // Seeded path: keep the measured rect, then FLIP to auth center.
      if (seeded) {
        setStage("home");
        setSeedFrozen(true);
        setBridging(true);

        let formTimer = 0;
        let raf2 = 0;
        let raf3 = 0;
        const raf1 = requestAnimationFrame(() => {
          void (
            absoluteBandRef.current?.offsetHeight ?? document.body.offsetHeight
          );
          raf2 = requestAnimationFrame(() => {
            setSeedFrozen(false);
            raf3 = requestAnimationFrame(() => {
              clearFromHomeFlag();
              applySeedRect(null, false);
              setStage("auth");
              formTimer = window.setTimeout(() => {
                setFormVisible(true);
                morphingIn.current = false;
              }, 360);
            });
          });
        });

        return () => {
          cancelAnimationFrame(raf1);
          cancelAnimationFrame(raf2);
          cancelAnimationFrame(raf3);
          window.clearTimeout(formTimer);
        };
      }

      // Direct /login (no home seed): peek → center as before.
      setStage("home");
      setBridging(false);

      let formTimer = 0;
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        void document.body.offsetHeight;
        raf2 = requestAnimationFrame(() => {
          clearFromHomeFlag();
          setStage("auth");
          formTimer = window.setTimeout(() => {
            setFormVisible(true);
            morphingIn.current = false;
          }, 360);
        });
      });

      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        window.clearTimeout(formTimer);
      };
    }

    if (isAuth && !morphingIn.current) {
      clearFromHomeFlag();
      setStage("auth");
      setCardMode("form");
      setFormVisible(true);
      setBridging(false);
    }
  }, [isAuth, handoff]);

  const absoluteStyle =
    seedRect != null ? seedStyleFromRect(seedRect, seedFrozen) : undefined;

  return (
    <div
      className={cn(
        "relative flex flex-col bg-white",
        homeMode
          ? "min-h-dvh overflow-x-hidden overflow-y-auto"
          : "h-dvh max-h-dvh overflow-hidden",
      )}
    >
      <AppHeader
        variant={headerMode}
        authBusy={headerMode === "marketing" ? authBusy : null}
        className={cn(
          "z-30 transition-colors duration-500",
          headerMode === "marketing" &&
            (exiting || workspaceIncoming
              ? "border-border"
              : "border-transparent"),
          homeMode && "sticky top-0 bg-white",
        )}
      />

      {homeMode ? (
        <>
          <div className="relative z-10 flex flex-col">{children}</div>
          <div
            ref={flowBandRef}
            data-stage="home"
            className={cn(
              "marketing-band marketing-band--flow z-20 bg-[color:var(--brand-accent)]",
              storyExit && "is-story-exiting",
            )}
          >
            <MarketingProductStory exiting={storyExit} />
          </div>
        </>
      ) : (
        <>
          <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col opacity-0" />

          {workspaceIncoming ? (
            <div
              className={cn(
                "marketing-workspace-incoming absolute inset-x-0 bottom-0 z-[15] overflow-y-auto bg-[color:var(--background)]",
                workspaceIn && "is-in",
              )}
              aria-hidden
            >
              <WorkspaceGhost includeHeader={false} />
            </div>
          ) : null}

          <div
            ref={absoluteBandRef}
            data-stage={stage}
            className="marketing-band absolute left-1/2 z-20 bg-[color:var(--brand-accent)]"
            style={absoluteStyle}
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
        </>
      )}
    </div>
  );
}
