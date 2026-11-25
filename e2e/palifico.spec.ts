import { expect, test, type Page } from "@playwright/test";
import {
  bidButton,
  callDudo,
  createRoom,
  joinRoom,
  makeBid,
  newPlayer,
  revealBanner,
  revealedDice,
  startGame,
} from "./helpers.ts";

/** The Palifico indicator shown to everyone during a Palifico Round. */
function palificoIndicator(page: Page) {
  return page.getByRole("status").filter({ hasText: "Palifico Round" });
}

// Seed 42 (playwright.config.ts), Ana and Ben: Ben opens Round 1. Ben bids all the dice on 6s
// in Rounds 1-4 and Ana calls Dudo each time (there are never that many), so Ben drops to 1 die.
// Round 5 (Palifico, Ben opens): Ana [3,1,1,4,4], Ben [2]: two 4s, Pacos don't count.
test("dropping to 1 die gives a Palifico Round: indicator, locked Face, Pacos not wild", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  await startGame(ana);
  const everyone = [ana, ben];

  for (const [round, total] of [
    [1, 10],
    [2, 9],
    [3, 8],
    [4, 7],
  ] as const) {
    await expect(ben.getByRole("heading", { name: `Round ${round}` })).toBeVisible();
    for (const page of everyone) await expect(palificoIndicator(page)).toHaveCount(0);
    await makeBid(ben, total, "6");
    await callDudo(ana);
    await expect(revealBanner(ana)).toContainText("Ben loses a die.");
    await ana.getByRole("button", { name: "Start next Round" }).click();
  }

  for (const page of everyone) {
    await expect(page.getByRole("heading", { name: "Round 5" })).toBeVisible();
    await expect(palificoIndicator(page)).toBeVisible();
  }
  await expect(ben.getByText("It's your Turn")).toBeVisible();
  // The Palifico Opener may open on Pacos.
  await ben.getByLabel("Count").fill("1");
  await expect(bidButton(ben, 1, "Paco")).toBeEnabled();
  await makeBid(ben, 1, "4");

  // The Face is locked to 4: only a higher count on 4 is possible.
  await expect(ana.getByText("It's your Turn")).toBeVisible();
  await expect(ana.getByText("The Face is locked to 4.")).toBeVisible();
  await expect(ana.getByRole("button", { name: "Calza" })).toBeDisabled();
  await expect(ana.getByText("Calza isn't allowed in a Palifico Round.")).toBeVisible();
  await ana.getByLabel("Count").fill("2");
  await expect(bidButton(ana, 2, "4")).toBeEnabled();
  for (const face of ["2", "3", "5", "6", "Paco"]) await expect(bidButton(ana, 2, face)).toBeDisabled();
  await makeBid(ana, 3, "4");

  await callDudo(ben);

  for (const page of everyone) {
    await expect(revealBanner(page)).toHaveText("Ben called Dudo on Ana's 3 × 4. There were 2. Ana loses a die.");
    await expect(revealedDice(page, "Ana")).toHaveText(["3", "1", "1", "4 (counts)", "4 (counts)"]);
    await expect(revealedDice(page, "Ben")).toHaveText(["2"]);
  }

  await ana.getByRole("button", { name: "Start next Round" }).click();

  for (const page of everyone) {
    await expect(page.getByRole("heading", { name: "Round 6" })).toBeVisible();
    await expect(palificoIndicator(page)).toHaveCount(0);
  }
});
