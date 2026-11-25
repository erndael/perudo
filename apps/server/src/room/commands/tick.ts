import type { CommandResult } from "../types.ts";

/**
 * Time passing, sent by the transport's timers (never by a client). The Room applies its
 * time-based rules around every command (see `index.ts`), so this one has nothing else to do.
 */
export interface TickCommand {
  type: "tick";
}

export function tick(): CommandResult {
  return { ok: true };
}
