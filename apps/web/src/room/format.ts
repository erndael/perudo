import { PACO, type Bid, type Face } from "@perudo/engine";

/** "4", "Paco". */
export function faceName(face: Face): string {
  return face === PACO ? "Paco" : String(face);
}

/** "3 × 4", "2 × Paco". */
export function formatBid({ count, face }: Bid): string {
  return `${count} × ${faceName(face)}`;
}
