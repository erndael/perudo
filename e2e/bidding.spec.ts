import { expect, test } from "@playwright/test";
import { bidButton, bidHistory, createRoom, joinRoom, makeBid, newPlayer, startGame } from "./helpers.ts";

// Seed 42 (playwright.config.ts): with Ana, Ben, Cat the first Game's Opener is Ben,
// so Turns go Ben -> Cat -> Ana. 15 dice in play.
test("players take Turns making Bids, with illegal Bids greyed out", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");
  await expect(ana.getByRole("button", { name: "Start Game" })).toBeEnabled();
  await startGame(ana);
  const everyone = [ana, ben, cat];

  await expect(ben.getByText("It's your Turn")).toBeVisible();
  for (const page of [ana, cat]) {
    await expect(page.getByText("It's Ben's Turn")).toBeVisible();
    await expect(page.getByRole("form", { name: "Your Bid" })).toHaveCount(0);
  }

  // The opening Bid can't be on Pacos.
  await ben.getByLabel("Count").fill("3");
  await expect(bidButton(ben, 3, "Paco")).toBeDisabled();
  await expect(bidButton(ben, 3, "2")).toBeEnabled();
  await makeBid(ben, 3, "4");

  for (const page of everyone) {
    await expect(bidHistory(page)).toHaveText(["Ben: 3 × 4"]);
  }
  await expect(cat.getByText("It's your Turn")).toBeVisible();
  await expect(ben.getByRole("form", { name: "Your Bid" })).toHaveCount(0);

  // From 3 × 4: same count needs a higher Face; Pacos need at least 2.
  await cat.getByLabel("Count").fill("3");
  for (const face of ["2", "3", "4"]) await expect(bidButton(cat, 3, face)).toBeDisabled();
  for (const face of ["5", "6", "Paco"]) await expect(bidButton(cat, 3, face)).toBeEnabled();
  await cat.getByLabel("Count").fill("1");
  await expect(bidButton(cat, 1, "Paco")).toBeDisabled();
  await makeBid(cat, 2, "Paco");

  // From 2 × Paco: leaving Pacos needs at least 5.
  await expect(ana.getByText("It's your Turn")).toBeVisible();
  await ana.getByLabel("Count").fill("4");
  await expect(bidButton(ana, 4, "6")).toBeDisabled();
  await expect(bidButton(ana, 4, "Paco")).toBeEnabled();
  await makeBid(ana, 5, "2");

  for (const page of everyone) {
    await expect(bidHistory(page)).toHaveText(["Ben: 3 × 4", "Cat: 2 × Paco", "Ana: 5 × 2"]);
  }
  await expect(ben.getByText("It's your Turn")).toBeVisible();
});
