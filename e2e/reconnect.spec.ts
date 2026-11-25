import { expect, test } from "@playwright/test";
import { createRoom, joinRoom, newPlayer, people, startGame, yourDice } from "./helpers.ts";

// Seed 42 (playwright.config.ts): a Room's first Game with Ana, Ben and Cat rolls these.
const BEN_DICE = ["2", "4", "6", "3", "2"];
const ANA_DICE = ["3", "6", "5", "2", "4"];

test("a player who refreshes mid-Game is back in their Seat with their dice", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");
  await startGame(ana);
  await expect(yourDice(ben)).toHaveText(BEN_DICE);

  await ben.reload();

  await expect(yourDice(ben)).toHaveText(BEN_DICE);
  await expect(people(ben)).toHaveText([/^Ana\b/, /^Ben You Opener 5 dice$/, /^Cat\b/]);
  await expect(ben.getByLabel("Nickname")).toHaveCount(0);
  await expect(people(ana)).toHaveText([/^Ana\b/, /^Ben Opener 5 dice$/, /^Cat\b/]);
});

test("everyone sees who is disconnected until they come back", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");
  await startGame(ana);
  await expect(yourDice(ana)).toHaveText(ANA_DICE);

  // Ana (the Host) closes her tab; her browser still remembers her Seat.
  const anaContext = ana.context();
  await ana.close();

  for (const page of [ben, cat]) {
    await expect(people(page)).toHaveText([/^Ana Host Disconnected 5 dice$/, /^Ben\b/, /^Cat\b/]);
  }

  const anaAgain = await anaContext.newPage();
  await anaAgain.goto(link);

  await expect(yourDice(anaAgain)).toHaveText(ANA_DICE);
  for (const page of [anaAgain, ben, cat]) {
    await expect(people(page)).toHaveText([/^Ana Host (You )?5 dice$/, /^Ben\b/, /^Cat\b/]);
  }
});
