import { expect, test } from "@playwright/test";
import {
  callDudo,
  createRoom,
  gameOver,
  joinRoom,
  makeBid,
  newPlayer,
  people,
  revealBanner,
  startGame,
  yourDice,
} from "./helpers.ts";

// Seed 42 (playwright.config.ts), Ana and Ben: Ben opens Round 1. Every Round Ben bids all the
// dice in play on 6 (never true), Ana calls Dudo and Ben loses a die, so he opens again.
// After Round 5 Ben has no dice left and Ana wins. Cat arrives mid-Game and waits.
// Rematch (Ana, Ben, Cat): Ben opens; Ana [2,2,5,6,4], Ben [2,2,2,1,4], Cat [5,5,6,1,6].
test("a Game played to the end: Eliminated, winner screen, then the Host starts a rematch", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  await expect(ana.getByRole("button", { name: "Start Game" })).toBeEnabled();
  await startGame(ana);
  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");
  await expect(cat.getByText("You'll join the next Game.")).toBeVisible();
  const everyone = [ana, ben, cat];

  for (let round = 1; round <= 5; round++) {
    const total = 10 - (round - 1);
    await expect(ben.getByRole("heading", { name: `Round ${round}` })).toBeVisible();
    await expect(ben.getByText("It's your Turn")).toBeVisible();
    await makeBid(ben, total, "6");
    await expect(ana.getByText("It's your Turn")).toBeVisible();
    await callDudo(ana);
    await expect(revealBanner(ana)).toContainText("Ben loses a die.");
    if (round < 5) await ana.getByRole("button", { name: "Start next Round" }).click();
  }

  for (const page of everyone) {
    await expect(gameOver(page)).toContainText("Ana wins the Game!");
    await expect(people(page).nth(1)).toContainText("Eliminated");
    await expect(page.getByRole("button", { name: "Start next Round" })).toHaveCount(0);
    await expect(page.getByText("Waiting for the Host to start the next Round.")).toHaveCount(0);
  }
  await expect(ben.getByText("You're Eliminated.")).toBeVisible();
  for (const page of [ben, cat]) {
    await expect(page.getByRole("button", { name: "Start rematch" })).toHaveCount(0);
    await expect(gameOver(page)).toContainText("Waiting for the Host to start a rematch.");
  }

  await ana.getByRole("button", { name: "Start rematch" }).click();

  for (const page of everyone) {
    await expect(page.getByRole("heading", { name: "Round 1" })).toBeVisible();
    await expect(gameOver(page)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Reveal" })).toHaveCount(0);
    await expect(people(page)).toHaveText([/^Ana.* 5 dice$/, /^Ben.*Opener.* 5 dice$/, /^Cat.* 5 dice$/]);
  }
  await expect(yourDice(ana)).toHaveText(["2", "2", "5", "6", "4"]);
  await expect(yourDice(ben)).toHaveText(["2", "2", "2", "1", "4"]);
  await expect(yourDice(cat)).toHaveText(["5", "5", "6", "1", "6"]);
  await expect(ben.getByText("It's your Turn")).toBeVisible();
});
