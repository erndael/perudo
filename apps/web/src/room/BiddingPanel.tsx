import { useState } from "react";
import { bidRules, isLegalBid, PACO, type BidRules, type CalzaBlock, type Face } from "@perudo/engine";
import type { ClientMessage, GameView, RoomView } from "@perudo/server/protocol";
import { faceName, formatBid } from "./format.ts";
import { nicknamesIn } from "./names.ts";

/** Why the Calza button is disabled, from the server's view of the Round. */
const CALZA_BLOCKED: Record<CalzaBlock, string> = {
  palifico: "Calza isn't allowed in a Palifico Round.",
  "two-players": "Calza isn't allowed with only 2 players left.",
};

/** In the order the Bid buttons show them: Faces by rank, Pacos last. */
const FACES: Face[] = [2, 3, 4, 5, 6, PACO];

/**
 * Whose Turn it is, the current Round's Bids, and on your Turn the Bid controls, plus Dudo and
 * Calza once there is a Bid (Calza disabled, with the reason, when the server says this Round forbids it).
 */
export function BiddingPanel({ view, send }: { view: RoomView; send(message: ClientMessage): void }) {
  const game = view.game;
  if (!game) return null;
  const nickname = nicknamesIn(view);
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
          <button
            type="button"
            disabled={game.calzaBlockedBy !== null}
            aria-describedby={game.calzaBlockedBy ? "calza-blocked" : undefined}
            onClick={() => send({ type: "calza" })}
          >
            Calza
          </button>
          {game.calzaBlockedBy && (
            <span id="calza-blocked" className="hint">
              {CALZA_BLOCKED[game.calzaBlockedBy]}
            </span>
          )}
        </div>
      )}
    </section>
  );
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
  const rules = bidRules(game);
  const lowest = lowestLegalCount(rules);
  const [count, setCount] = useState(lowest ?? 1);

  if (lowest === null) return <p className="hint">No Raise is possible.</p>;

  return (
    <form aria-label="Your Bid" className="bid-controls" onSubmit={(e) => e.preventDefault()}>
      {rules.palifico && (
        <p className="hint">
          {rules.current
            ? `The Face is locked to ${faceName(rules.current.face)}.`
            : "You open this Palifico Round: any Face, Pacos included."}
        </p>
      )}
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
