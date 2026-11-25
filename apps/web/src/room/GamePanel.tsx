import type { GameView, PlayerId } from "@perudo/server/protocol";
import { Reveal3D, YourDice3D } from "../dice/Dice3D.tsx";

interface GamePanelProps {
  game: GameView;
  you: PlayerId;
  nickname: (id: PlayerId) => string;
  /** Whether the 3D dice are running (see `use3D`); `onFail3D` switches back to the HTML dice. */
  diceIn3D: boolean;
  onFail3D: () => void;
}

/**
 * The Game in progress: Round, total dice in play and the viewer's own dice (thrown in 3D).
 * At the end of a Round the 3D view shows every player's dice instead (the reveal), until the next Round's throw.
 */
export function GamePanel({ game, you, nickname, diceIn3D, onFail3D }: GamePanelProps) {
  const eliminated = game.players.some((p) => p.id === you && p.dieCount === 0);
  return (
    <section className="game">
      <h2>Round {game.round}</h2>
      {game.palifico && (
        <p role="status" className="palifico">
          <strong>Palifico Round</strong>: Pacos aren't wild, and every Bid keeps the opening Bid's Face.
        </p>
      )}
      <p>Total dice in play: {game.totalDice}</p>
      {eliminated && <p className="eliminated">You're Eliminated. You can keep watching the Game.</p>}
      {game.yourDice ? (
        <>
          <h3 id="your-dice-heading">Your dice</h3>
          {/* The server's Faces as HTML: the accessible (and tested) truth. Visually hidden while the 3D dice show them. */}
          <ol aria-labelledby="your-dice-heading" className={diceIn3D ? "dice visually-hidden" : "dice"}>
            {game.yourDice.map((face, i) => (
              <li key={i} className="die">
                {face}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>You'll join the next Game.</p>
      )}
      {/* One 3D scene at a time: the reveal while the Round is over, otherwise the viewer's own throw. */}
      {diceIn3D &&
        (game.reveal ? (
          <Reveal3D
            // Players Eliminated before this Round rolled no dice: nothing to lay out for them.
            players={game.reveal.players
              .filter((p) => p.dice.length > 0)
              .map((p) => ({ ...p, nickname: nickname(p.id) }))}
            onFail={onFail3D}
          />
        ) : (
          game.yourDice && (
            <YourDice3D faces={game.yourDice} throwKey={`${game.round}:${game.yourDice.join("")}`} onFail={onFail3D} />
          )
        ))}
    </section>
  );
}
