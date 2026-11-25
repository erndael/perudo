// Secrets this browser keeps per Room code, in localStorage. Storage can be unavailable
// (private mode, blocked site data): then nothing is remembered and every read is null.

function perRoom(prefix: string) {
  const key = (code: string) => `perudo:${prefix}:${code}`;
  return {
    load(code: string): string | null {
      try {
        return window.localStorage.getItem(key(code));
      } catch {
        return null;
      }
    },
    save(code: string, value: string) {
      try {
        window.localStorage.setItem(key(code), value);
      } catch {
        /* not remembered */
      }
    },
    forget(code: string) {
      try {
        window.localStorage.removeItem(key(code));
      } catch {
        /* nothing to forget */
      }
    },
  };
}

/** The token that puts this browser back in its Seat after a refresh or a dropped connection. */
export const reconnectTokens = perRoom("reconnect-token");

/** Kept by the browser that created the Room until it joins: joining with it makes that person Host. */
export const hostKeys = perRoom("host-key");
