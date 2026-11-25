import { expect, test } from "@playwright/test";
import {
  bidHistory,
  callDudo,
  createRoom,
  joinRoom,
  makeBid,
  newPlayer,
  people,
  revealBanner,
  revealedDice,
  startGame,
  yourDice,
} from "./helpers.ts";

// Seed 42 (playwright.config.ts), Ana, Ben, Cat: Ben opens Round 1, Turns go Ben -> Cat -> Ana.
// Round 1 dice: Ana [3,6,5,2,4], Ben [2,4,6,3,2], Cat [6,5,2,2,4]: three 6s, no Pacos.
// Round 2 (Cat lost a die): Ana [5,4,1,3,6], Ben [1,4,1,2,1], Cat [2,5,4,1].
test("a Round played to Dudo: reveal, banner, then the Host starts the next Round", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");
  await expect(ana.getByRole("button", { name: "Start Game" })).toBeEnabled();
  await startGame(ana);
  const everyone = [ana, ben, cat];

  // No Bid yet: nothing to call Dudo on.
  await expect(ben.getByText("It's your Turn")).toBeVisible();
  await expect(ben.getByRole("button", { name: "Dudo" })).toHaveCount(0);
  await makeBid(ben, 3, "4");
  await expect(cat.getByText("It's your Turn")).toBeVisible();
  await makeBid(cat, 4, "6");
  await expect(ana.getByText("It's your Turn")).toBeVisible();
  for (const page of [ben, cat]) await expect(page.getByRole("button", { name: "Dudo" })).toHaveCount(0);

  await callDudo(ana);

  for (const page of everyone) {
    await expect(revealBanner(page)).toHaveText("Ana called Dudo on Cat's 4 × 6. There were 3. Cat loses a die.");
    await expect(revealedDice(page, "Ana")).toHaveText(["3", "6 (counts)", "5", "2", "4"]);
    await expect(revealedDice(page, "Ben")).toHaveText(["2", "4", "6 (counts)", "3", "2"]);
    await expect(revealedDice(page, "Cat")).toHaveText(["6 (counts)", "5", "2", "2", "4"]);
    await expect(people(page).nth(2)).toContainText("4 dice");
    await expect(page.getByRole("form", { name: "Your Bid" })).toHaveCount(0);
  }
  for (const page of [ben, cat]) {
    await expect(page.getByRole("button", { name: "Start next Round" })).toHaveCount(0);
    await expect(page.getByText("Waiting for the Host to start the next Round.")).toBeVisible();
  }

  await ana.getByRole("button", { name: "Start next Round" }).click();

  for (const page of everyone) {
    await expect(page.getByRole("heading", { name: "Round 2" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Reveal" })).toHaveCount(0);
    await expect(bidHistory(page)).toHaveCount(0);
  }
  await expect(yourDice(ana)).toHaveText(["5", "4", "1", "3", "6"]);
  await expect(yourDice(ben)).toHaveText(["1", "4", "1", "2", "1"]);
  await expect(yourDice(cat)).toHaveText(["2", "5", "4", "1"]);
  await expect(cat.getByText("It's your Turn")).toBeVisible();
  await expect(people(ana).nth(2)).toContainText("Opener");
});
