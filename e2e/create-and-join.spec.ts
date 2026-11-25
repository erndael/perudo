import { expect, test } from "@playwright/test";
import { createRoom, enterNickname, joinRoom, newPlayer, openNewRoom, people } from "./helpers.ts";

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

test("a friend joins by typing the Room code on the home page", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const code = link.split("/r/")[1]!;

  const ben = await newPlayer(browser);
  await ben.goto("/");
  await ben.getByLabel("Room code").fill(` ${code.toLowerCase()} `);
  await ben.getByRole("button", { name: "Join Room" }).click();
  await expect(ben).toHaveURL(new RegExp(`/r/${code}$`));
  await enterNickname(ben, "Ben");

  await expect(people(ben)).toHaveText([/^Ana\s*Host$/, /^Ben\s*You$/]);
});

test("a friend joins by pasting the Room link into the code box", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");

  const ben = await newPlayer(browser);
  await ben.goto("/");
  await ben.getByLabel("Room code").fill(link);
  await ben.getByRole("button", { name: "Join Room" }).click();
  await enterNickname(ben, "Ben");

  await expect(people(ben)).toHaveText([/^Ana\s*Host$/, /^Ben\s*You$/]);
});

test("the person who created the Room is Host, even if a friend joins before them", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await openNewRoom(ana);

  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  await expect(people(ben)).toHaveText([/^Ben\s*Host\s*You$/]);

  await enterNickname(ana, "Ana");

  await expect(people(ana)).toHaveText([/^Ben$/, /^Ana\s*Host\s*You$/]);
  await expect(people(ben)).toHaveText([/^Ben\s*You$/, /^Ana\s*Host$/]);
});

test("opening a Room link asks for a nickname before showing the Room", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");

  const ben = await newPlayer(browser);
  await ben.goto(link);

  await expect(ben.getByLabel("Nickname")).toBeVisible();
  await expect(people(ben)).toHaveCount(0);
});
