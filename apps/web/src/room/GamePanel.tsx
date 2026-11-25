import type { GameView } from "@perudo/server/protocol";
import { Reveal3D, YourDice3D } from "../dice/Dice3D.tsx";

interface GamePanelProps {
  game: GameView;
  nickname: (id: string) => string;
  /** Whether the 3D dice are running (see `use3D`); `onFail3D` switches back to the HTML dice. */
  threeD: boolean;
  onFail3D: () => void;
}

/**
 * The Game in progress: Round, total dice in play and the viewer's own dice (thrown in 3D).
 * At the end of a Round the 3D view shows every player's dice instead (the reveal), until the next Round's throw.
 */
export function GamePanel({ game, nickname, threeD, onFail3D }: GamePanelProps) {
  return (
    <section className="game">
      <h2>Round {game.round}</h2>
      <p>Total dice in play: {game.totalDice}</p>
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
        </>
      ) : (
        <p>You'll join the next Game.</p>
      )}
      {/* One 3D scene at a time: the reveal while the Round is over, otherwise the viewer's own throw. */}
      {threeD &&
        (game.reveal ? (
          <Reveal3D
            players={game.reveal.players.map((p) => ({ ...p, nickname: nickname(p.id) }))}
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
