// The command table. To add a command: write `commands/<name>.ts` exporting its
// command type and handler, then add one line to `RoomCommand` and one to `handlers`.
import type { CommandResult, RoomContext, RoomState } from "../types.ts";
import { join, type JoinCommand } from "./join.ts";
import { startGame, type StartGameCommand } from "./start-game.ts";

export type RoomCommand =
  | JoinCommand
  | StartGameCommand;

type Handler<C> = (state: RoomState, command: C, ctx: RoomContext) => CommandResult;

export const handlers: { [K in RoomCommand["type"]]: Handler<Extract<RoomCommand, { type: K }>> } = {
  join,
  "start-game": startGame,
};
