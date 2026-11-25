// The command table. To add a command: write `commands/<name>.ts` exporting its
// command type and handler, then add one line to `RoomCommand` and one to `handlers`.
import type { CommandResult, RoomContext, RoomState } from "../types.ts";
import { bid, type BidCommand } from "./bid.ts";
import { calza, type CalzaCommand } from "./calza.ts";
import { disconnect, type DisconnectCommand } from "./disconnect.ts";
import { dudo, type DudoCommand } from "./dudo.ts";
import { join, type JoinCommand } from "./join.ts";
import { kick, type KickCommand } from "./kick.ts";
import { leave, type LeaveCommand } from "./leave.ts";
import { reconnect, type ReconnectCommand } from "./reconnect.ts";
import { startGame, type StartGameCommand } from "./start-game.ts";
import { startNextRound, type StartNextRoundCommand } from "./start-next-round.ts";
import { tick, type TickCommand } from "./tick.ts";

export type RoomCommand =
  | JoinCommand
  | StartGameCommand
  | BidCommand
  | ReconnectCommand
  | DisconnectCommand
  | TickCommand
  | DudoCommand
  | StartNextRoundCommand
  | CalzaCommand
  | LeaveCommand
  | KickCommand;

type Handler<C> = (state: RoomState, command: C, ctx: RoomContext) => CommandResult;

export const handlers: { [K in RoomCommand["type"]]: Handler<Extract<RoomCommand, { type: K }>> } = {
  join,
  "start-game": startGame,
  bid,
  reconnect,
  disconnect,
  tick,
  dudo,
  "start-next-round": startNextRound,
  calza,
  leave,
  kick,
};
