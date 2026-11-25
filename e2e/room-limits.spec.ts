import { expect, test } from "@playwright/test";
import { createRoom, enterNickname, joinRoom, newPlayer, people, startGame, yourDice } from "./helpers.ts";

test("a 7th person is told the Room is full", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  for (const nickname of ["Ben", "Cat", "Dan", "Eve", "Fay"]) {
    await joinRoom(await newPlayer(browser), link, nickname);
  }
  await expect(people(ana)).toHaveCount(6);

  const gus = await newPlayer(browser);
  await joinRoom(gus, link, "Gus");

  await expect(gus.getByRole("alert")).toContainText("Room full");
  await expect(people(gus)).toHaveCount(0);
  await expect(people(ana)).toHaveCount(6);
});

test("a nickname already taken in the Room is refused and another can be chosen", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");

  const other = await newPlayer(browser);
  await joinRoom(other, link, "ana");
  await expect(other.getByRole("alert")).toContainText("already taken");

  await enterNickname(other, "Ben");
  await expect(people(other)).toHaveText([/^Ana\s*Host$/, /^Ben\s*You$/]);
});

test("someone arriving mid-Game is shown as waiting and gets no dice", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  await joinRoom(await newPlayer(browser), link, "Ben");
  await startGame(ana);
  await expect(yourDice(ana)).toHaveCount(5);

  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");

  await expect(people(cat)).toHaveText([/^Ana\b.*5 dice$/, /^Ben\b.*5 dice$/, /^Cat\s*You\s*Waiting$/]);
  await expect(people(ana).nth(2)).toHaveText(/^Cat\s*Waiting$/);
  await expect(yourDice(cat)).toHaveCount(0);
  await expect(cat.getByText("You'll join the next Game.")).toBeVisible();
});

test("opening an unknown Room code shows a clear message", async ({ browser }) => {
  const page = await newPlayer(browser);
  await page.goto("/r/ZZZZZZ");

  await expect(page.getByText("This Room doesn't exist or has expired.")).toBeVisible();
  await expect(page.getByLabel("Nickname")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create a new Room" })).toBeVisible();
});
