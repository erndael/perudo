import type { GameView } from "@perudo/server/protocol";

/** The Game in progress: Round, total dice in play and the viewer's own dice (plain HTML for now). */
export function GamePanel({ game }: { game: GameView }) {
  return (
    <section className="game">
      <h2>Round {game.round}</h2>
      <p>Total dice in play: {game.totalDice}</p>
      {game.yourDice ? (
        <>
          <h3 id="your-dice-heading">Your dice</h3>
          <ol aria-labelledby="your-dice-heading" className="dice">
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
    </section>
  );
}
