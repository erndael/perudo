import type { GameView } from "@perudo/server/protocol";
import { use3D, YourDice3D } from "../dice/Dice3D.tsx";

/** The Game in progress: Round, total dice in play and the viewer's own dice (thrown in 3D). */
export function GamePanel({ game, you }: { game: GameView; you: string }) {
  const [threeD, fail3D] = use3D();
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
          <ol aria-labelledby="your-dice-heading" className={threeD ? "dice visually-hidden" : "dice"}>
            {game.yourDice.map((face, i) => (
              <li key={i} className="die">
                {face}
              </li>
            ))}
          </ol>
          {threeD && (
            <YourDice3D faces={game.yourDice} throwKey={`${game.round}:${game.yourDice.join("")}`} onFail={fail3D} />
          )}
        </>
      ) : (
        <p>You'll join the next Game.</p>
      )}
    </section>
  );
}
