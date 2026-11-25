// Journeys shared by e2e tests. Assert on the HTML layer, never the 3D canvas.
import { expect, type Browser, type Page } from "@playwright/test";

/** A fresh browser context (separate storage, like a separate person) with one page. */
export async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

/** Creates a Room from the home page and joins it with `nickname`. Returns the Room link. */
export async function createRoom(page: Page, nickname: string): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a Room" }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z0-9]{6}$/);
  await enterNickname(page, nickname);
  return page.url();
}

/** Opens a Room link and joins with `nickname`. */
export async function joinRoom(page: Page, link: string, nickname: string): Promise<void> {
  await page.goto(link);
  await enterNickname(page, nickname);
}

export async function enterNickname(page: Page, nickname: string): Promise<void> {
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByRole("button", { name: "Join" }).click();
}

/** The people list items, in Seat order. Each reads like "Ana Host You", plus "Opener" and "5 dice" during a Game. */
export function people(page: Page) {
  return page.getByRole("list", { name: "People" }).getByRole("listitem");
}

/** The viewer's own dice, one item per die, each the Face as text ("1".."6"). */
export function yourDice(page: Page) {
  return page.getByRole("list", { name: "Your dice" }).getByRole("listitem");
}

/** The Host starts a Game from the Room page. */
export async function startGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Start Game" }).click();
}
