import { expect, test } from "@playwright/test";
import { createRoom, joinRoom, newPlayer, people } from "./helpers.ts";

test("a player creates a Room and friends join it by link", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");

  await expect(people(ana)).toHaveText([/^Ana\s*Host\s*You$/]);

  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");

  await expect(people(ben)).toHaveText([/^Ana\s*Host$/, /^Ben\s*You$/]);
  await expect(people(ana)).toHaveText([/^Ana\s*Host\s*You$/, /^Ben$/]);

  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");

  for (const page of [ana, ben]) {
    await expect(people(page)).toHaveText([/^Ana\s*Host/, /^Ben/, /^Cat$/]);
  }
  await expect(people(cat)).toHaveText([/^Ana\s*Host$/, /^Ben$/, /^Cat\s*You$/]);
});

test("opening a Room link asks for a nickname before showing the Room", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");

  const ben = await newPlayer(browser);
  await ben.goto(link);

  await expect(ben.getByLabel("Nickname")).toBeVisible();
  await expect(people(ben)).toHaveCount(0);
});
