import { expect, test } from "@playwright/test";
import { createRoom, joinRoom, newPlayer, people, startGame, yourDice } from "./helpers.ts";

// The e2e server runs with PERUDO_RNG_SEED=42 (playwright.config.ts). Every Room gets
// its own RNG seeded with it, so a Room's first Game always rolls these dice.
const SEED_42_FIRST_GAME = {
  opener: "Ben",
  dice: { Ana: ["3", "6", "5", "2", "4"], Ben: ["2", "4", "6", "3", "2"], Cat: ["6", "5", "2", "2", "4"] },
};

test("the Host starts a Game and each player sees only their own dice", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");

  const start = ana.getByRole("button", { name: "Start Game" });
  await expect(start).toBeDisabled();

  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");

  await expect(people(ana)).toHaveCount(3);
  await expect(ben.getByRole("button", { name: "Start Game" })).toHaveCount(0);
  await expect(start).toBeEnabled();
  await startGame(ana);

  const players = { Ana: ana, Ben: ben, Cat: cat };
  for (const [nickname, page] of Object.entries(players)) {
    await expect(yourDice(page)).toHaveText(SEED_42_FIRST_GAME.dice[nickname as keyof typeof players]);
    await expect(page.getByText("Total dice in play: 15")).toBeVisible();
    await expect(people(page)).toHaveText([/^Ana\b.*5 dice$/, /^Ben\b.*Opener.*5 dice$/, /^Cat\b.*5 dice$/]);
    await expect(page.getByRole("button", { name: "Start Game" })).toHaveCount(0);
  }
});
