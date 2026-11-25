import type { RevealView, RoomView } from "@perudo/server/protocol";
import { formatBid } from "./BiddingPanel.tsx";

/**
 * "Ana called Dudo on Cat's 4 × 6. There were 3. Cat loses a die."
 * "Cat called Calza on Ben's 8 × 4. There were exactly 8. Cat gains a die." (or "already has 5 dice.")
 */
export function outcomeBanner(reveal: RevealView, nickname: (id: string) => string): string {
  const { call, caller, bid, actualCount, dieChange } = reveal.outcome;
  const count = actualCount === bid.count ? `exactly ${actualCount}` : String(actualCount);
  const change = dieChange.delta < 0 ? "loses a die" : dieChange.delta > 0 ? "gains a die" : "already has 5 dice";
  return (
    `${nickname(caller)} called ${call === "calza" ? "Calza" : "Dudo"} on ${nickname(bid.by)}'s ${formatBid(bid)}. ` +
    `There ${actualCount === 1 ? "was" : "were"} ${count}. ${nickname(dieChange.player)} ${change}.`
  );
}

/**
 * The end of a Round: the outcome banner and every player's dice, with the dice that count
 * toward the called Bid marked (as decided by the server). Plain HTML; the 3D reveal (12)
 * can sit on top of it the way the 3D throw sits on top of "Your dice".
 */
export function RevealPanel({ view }: { view: RoomView }) {
  const reveal = view.game?.reveal;
  if (!reveal) return null;
  const nickname = (id: string) => view.people.find((p) => p.id === id)?.nickname ?? "?";

  return (
    <section className="reveal" aria-labelledby="reveal-heading">
      <h3 id="reveal-heading">Reveal</h3>
      <p className="banner" aria-live="polite">
        {outcomeBanner(reveal, nickname)}
      </p>
      {reveal.players.map((player) => (
        <div key={player.id} className="revealed-player">
          <span className="nickname">{nickname(player.id)}</span>
          <ol aria-label={`${nickname(player.id)}'s dice`} className="dice">
            {player.dice.map((die, i) => (
              <li key={i} className={die.counts ? "die counts" : "die"}>
                {die.face}
                {die.counts && <span className="visually-hidden"> (counts)</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {view.you !== view.hostId && view.game?.phase === "reveal" && <p className="hint">Waiting for the Host to start the next Round.</p>}
    </section>
  );
}
