import { expect, test } from "@playwright/test";
import { bidHistory, createRoom, gameOver, joinRoom, makeBid, newPlayer, people, startGame, yourDice } from "./helpers.ts";

// Seed 42 (playwright.config.ts): Ana, Ben and Cat's first Game is opened by Ben.
test("the Host kicks a player mid-Round: the Round is re-rolled without them; then the last other player leaves", async ({
  browser,
}) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");
  await startGame(ana);
  await makeBid(ben, 3, "4");
  await expect(cat.getByText("It's your Turn")).toBeVisible();

  await ana.getByRole("button", { name: "Kick Cat" }).click();

  // Cat is out of the Room, and their browser no longer holds the Seat.
  await expect(cat.getByRole("status")).toHaveText("The Host kicked you from the Room. You can join again with a nickname.");
  await expect(cat.getByLabel("Nickname")).toBeVisible();
  await cat.reload();
  await expect(cat.getByLabel("Nickname")).toBeVisible();

  // The Round was cancelled: Round 2, no Bids, 5 dice each, and Ana (after Cat in Seat order) opens.
  for (const page of [ana, ben]) {
    await expect(people(page)).toHaveText([/^Ana Host (You )?Opener 5 dice$/, /^Ben (You )?5 dice$/]);
    await expect(page.getByRole("heading", { name: "Round 2" })).toBeVisible();
    await expect(bidHistory(page)).toHaveCount(0);
    await expect(yourDice(page)).toHaveCount(5);
  }
  await expect(ana.getByText("It's your Turn")).toBeVisible();

  await ben.getByRole("button", { name: "Leave Room" }).click();

  await expect(ben.getByRole("status")).toHaveText("You left the Room. You can join again with a nickname.");
  await expect(gameOver(ana)).toContainText("Ana wins the Game!");
  await expect(people(ana)).toHaveText([/^Ana Host You Opener 5 dice$/]);
});
