export const AUTH_PENDING_EVENT = "omt:auth-pending";
export const AUTH_EXIT_EVENT = "omt:auth-exit";
/** Set before auth→workspace navigation so loading UI can stay quiet. */
export const FROM_AUTH_TRANSITION_KEY = "omt-from-auth-transition";

export type AuthBusyMode = "login" | "signup" | null;

type AuthPendingDetail = {
  mode: AuthBusyMode;
};

type AuthExitDetail = {
  href: string;
  done: () => void;
};

export function setAuthChromeBusy(mode: AuthBusyMode) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AuthPendingDetail>(AUTH_PENDING_EVENT, {
      detail: { mode },
    }),
  );
}

export function markFromAuthTransition() {
  try {
    sessionStorage.setItem(FROM_AUTH_TRANSITION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeFromAuthTransition() {
  try {
    const on = sessionStorage.getItem(FROM_AUTH_TRANSITION_KEY) === "1";
    if (on) sessionStorage.removeItem(FROM_AUTH_TRANSITION_KEY);
    return on;
  } catch {
    return false;
  }
}

export function peekFromAuthTransition() {
  try {
    return sessionStorage.getItem(FROM_AUTH_TRANSITION_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * After auth succeeds: load workspace inside the blue card, then morph the
 * card to a header hairline that splits away while workspace slides up.
 */
export function playAuthToWorkspaceTransition(href: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    window.dispatchEvent(
      new CustomEvent<AuthExitDetail>(AUTH_EXIT_EVENT, {
        detail: { href, done },
      }),
    );

    // Fallback when MarketingFrame is not mounted.
    window.setTimeout(done, 3200);
  });
}

/** @deprecated use playAuthToWorkspaceTransition */
export function playAuthExitTransition(): Promise<void> {
  return playAuthToWorkspaceTransition(workspaceHref());
}

export function workspaceHref(next?: string) {
  return next && next.startsWith("/") ? next : "/workspace";
}
