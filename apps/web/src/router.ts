// Minimal client-side routing: "/" is home, "/r/<code>" is a Room.
import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function navigate(path: string): void {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function roomCodeFromPath(pathname: string): string | null {
  return /^\/r\/([A-Za-z0-9]+)\/?$/.exec(pathname)?.[1]?.toUpperCase() ?? null;
}

/** What someone typed or pasted to join a Room: a code (any case, spaces/dashes ignored) or a Room link. */
export function roomCodeFromInput(input: string): string | null {
  const text = input.trim();
  const fromLink = /\/r\/([^/?#\s]+)\/?(?:[?#].*)?$/.exec(text)?.[1];
  const code = (fromLink ?? (text.includes("/") ? "" : text.replace(/[\s-]/g, ""))).toUpperCase();
  return /^[A-Z0-9]+$/.test(code) ? code : null;
}
