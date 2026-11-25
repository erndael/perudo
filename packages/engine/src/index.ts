// Pure Perudo rules engine (ADR-0003): no I/O, RNG passed in.
// Shared with the web app only to grey out illegal Bids; the server stays authoritative.

/** The value showing on a die. A Face of 1 is a Paco. */
export type Face = 1 | 2 | 3 | 4 | 5 | 6;
