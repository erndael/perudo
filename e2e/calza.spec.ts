import { expect, test } from "@playwright/test";
import { callCalza, createRoom, joinRoom, makeBid, newPlayer, people, revealBanner, revealedDice, startGame } from "./helpers.ts";

// Seed 42 (playwright.config.ts), Ana, Ben, Cat: Ben opens Round 1, Turns go Ben -> Cat -> Ana.
// Round 1 dice: Ana [3,6,5,2,4], Ben [2,4,6,3,2], Cat [6,5,2,2,4]: three 4s, no Pacos.
// Round 2 (Cat lost a die): Ana [5,4,1,3,6], Ben [1,4,1,2,1], Cat [2,5,4,1]: three 4s + five Pacos = 8.
test("the Host's Calza option, then a wrong and an exact Calza", async ({ browser }) => {
  const ana = await newPlayer(browser);
  const link = await createRoom(ana, "Ana");
  const ben = await newPlayer(browser);
  await joinRoom(ben, link, "Ben");
  const cat = await newPlayer(browser);
  await joinRoom(cat, link, "Cat");
  const everyone = [ana, ben, cat];

  // On by default; only the Host can switch it, and everyone sees it.
  const calzaOption = ana.getByRole("checkbox", { name: "Calza" });
  await expect(calzaOption).toBeChecked();
  for (const page of [ben, cat]) {
    await expect(page.getByRole("checkbox", { name: "Calza" })).toHaveCount(0);
    await expect(page.getByText("Calza is on.")).toBeVisible();
  }
  // The checkbox follows the server's view, so click and wait for it rather than uncheck()/check().
  await calzaOption.click();
  await expect(calzaOption).not.toBeChecked();
  for (const page of [ben, cat]) await expect(page.getByText("Calza is off.")).toBeVisible();
  await calzaOption.click();
  await expect(calzaOption).toBeChecked();
  for (const page of everyone) await expect(page.getByText("Calza is on.")).toBeVisible();

  await startGame(ana);
  await expect(ana.getByRole("checkbox", { name: "Calza" })).toHaveCount(0);

  // No Bid yet: nothing to call Calza on.
  await expect(ben.getByText("It's your Turn")).toBeVisible();
  await expect(ben.getByRole("button", { name: "Calza" })).toHaveCount(0);
  await makeBid(ben, 2, "4");
  await expect(cat.getByText("It's your Turn")).toBeVisible();
  for (const page of [ana, ben]) await expect(page.getByRole("button", { name: "Calza" })).toHaveCount(0);

  await callCalza(cat);

  for (const page of everyone) {
    await expect(revealBanner(page)).toHaveText("Cat called Calza on Ben's 2 × 4. There were 3. Cat loses a die.");
    await expect(revealedDice(page, "Cat")).toHaveText(["6", "5", "2", "2", "4 (counts)"]);
    await expect(people(page).nth(0)).toContainText("5 dice");
    await expect(people(page).nth(1)).toContainText("5 dice");
    await expect(people(page).nth(2)).toContainText("4 dice");
  }

  await ana.getByRole("button", { name: "Start next Round" }).click();

  // The caller opens the next Round.
  await expect(cat.getByText("It's your Turn")).toBeVisible();
  await makeBid(cat, 1, "4");
  await expect(ana.getByText("It's your Turn")).toBeVisible();
  await makeBid(ana, 2, "4");
  await expect(ben.getByText("It's your Turn")).toBeVisible();
  await makeBid(ben, 8, "4");
  await expect(cat.getByText("It's your Turn")).toBeVisible();

  await callCalza(cat);

  for (const page of everyone) {
    await expect(revealBanner(page)).toHaveText("Cat called Calza on Ben's 8 × 4. There were exactly 8. Cat gains a die.");
    await expect(people(page).nth(2)).toContainText("5 dice");
  }
});
