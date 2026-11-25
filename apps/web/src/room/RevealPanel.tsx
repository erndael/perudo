import type { RevealView, RoomView } from "@perudo/server/protocol";
import { formatBid } from "./BiddingPanel.tsx";
import { nicknameOf } from "./names.ts";

/** "Ana called Dudo on Cat's 4 × 6. There were 3. Cat loses a die." */
export function outcomeBanner(reveal: RevealView, nickname: (id: string) => string): string {
  const { caller, bid, actualCount, dieChange } = reveal.outcome;
  const count = actualCount === bid.count ? `exactly ${actualCount}` : String(actualCount);
  const change = dieChange.delta < 0 ? "loses a die" : "gains a die";
  return (
    `${nickname(caller)} called Dudo on ${nickname(bid.by)}'s ${formatBid(bid)}. ` +
    `There ${actualCount === 1 ? "was" : "were"} ${count}. ${nickname(dieChange.player)} ${change}.`
  );
}

/**
 * The end of a Round: the outcome banner and every player's dice, with the dice that count
 * toward the called Bid marked (as decided by the server). With `diceIn3D` the 3D reveal shows the
 * dice, so the per-player lists are only visually hidden (still the accessible, tested truth); the
 * banner stays visible either way.
 */
export function RevealPanel({ view, diceIn3D = false }: { view: RoomView; diceIn3D?: boolean }) {
  const reveal = view.game?.reveal;
  if (!reveal) return null;
  const nickname = (id: string) => nicknameOf(view, id);

  return (
    <section className="reveal" aria-labelledby="reveal-heading">
      <h3 id="reveal-heading">Reveal</h3>
      <p className="banner" aria-live="polite">
        {outcomeBanner(reveal, nickname)}
      </p>
      {reveal.players.map((player) => (
        <div key={player.id} className={diceIn3D ? "revealed-player visually-hidden" : "revealed-player"}>
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
