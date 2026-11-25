import { useState } from "react";
import { isLegalBid, type Bid, type BidRules, type Face } from "@perudo/engine";
import type { ClientMessage, GameView, RoomView } from "@perudo/server/protocol";

const FACES: Face[] = [2, 3, 4, 5, 6, 1];

/** "3 × 4", "2 × Paco". */
export function formatBid({ count, face }: Bid): string {
  return `${count} × ${face === 1 ? "Paco" : face}`;
}

/** Whose Turn it is, the current Round's Bids, and on your Turn the Bid controls and Dudo (once there is a Bid). */
export function BiddingPanel({ view, send }: { view: RoomView; send(message: ClientMessage): void }) {
  const game = view.game;
  if (!game) return null;
  const nickname = (id: string) => view.people.find((p) => p.id === id)?.nickname ?? "?";
  const bidding = game.phase === "bidding";
  const yourTurn = bidding && game.turn === view.you;

  return (
    <section className="bidding">
      {bidding && <p className="turn">{yourTurn ? "It's your Turn" : `It's ${nickname(game.turn)}'s Turn`}</p>}
      <h3 id="bids-heading">Bids</h3>
      {game.bids.length === 0 ? (
        <p className="hint">No Bids yet this Round.</p>
      ) : (
        <ol aria-labelledby="bids-heading" className="bids">
          {game.bids.map((bid, i) => (
            <li key={i}>
              {nickname(bid.by)}: {formatBid(bid)}
            </li>
          ))}
        </ol>
      )}
      {/* Keyed by the number of Bids so the count resets to a sensible default each Turn. */}
      {yourTurn && <BidControls key={game.bids.length} game={game} send={send} />}
      {yourTurn && game.bids.length > 0 && (
        <div className="turn-actions">
          <button type="button" onClick={() => send({ type: "dudo" })}>
            Dudo
          </button>
        </div>
      )}
    </section>
  );
}

function rulesFor(game: GameView): BidRules {
  return { current: game.bids.at(-1) ?? null, totalDice: game.totalDice, palifico: game.palifico };
}

/** The lowest count with at least one legal Bid, or null if no Bid is legal. */
function lowestLegalCount(rules: BidRules): number | null {
  for (let count = 1; count <= rules.totalDice; count++) {
    if (FACES.some((face) => isLegalBid({ count, face }, rules))) return count;
  }
  return null;
}

/** Choose a count, then click a Face to Bid. Illegal Bids are greyed out (the server checks again). */
function BidControls({ game, send }: { game: GameView; send(message: ClientMessage): void }) {
  const rules = rulesFor(game);
  const lowest = lowestLegalCount(rules);
  const [count, setCount] = useState(lowest ?? 1);

  if (lowest === null) return <p className="hint">No Raise is possible.</p>;

  return (
    <form aria-label="Your Bid" className="bid-controls" onSubmit={(e) => e.preventDefault()}>
      <label>
        Count
        <input
          type="number"
          min={1}
          max={game.totalDice}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
      </label>
      <div className="faces">
        {FACES.map((face) => (
          <button
            key={face}
            type="button"
            disabled={!isLegalBid({ count, face }, rules)}
            onClick={() => send({ type: "bid", count, face })}
          >
            Bid {formatBid({ count, face })}
          </button>
        ))}
      </div>
    </form>
  );
}
