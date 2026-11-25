import { reject, type CommandResult, type RoomContext, type RoomState } from "../types.ts";

export interface JoinCommand {
  type: "join";
  nickname: string;
}

export function join(state: RoomState, command: JoinCommand, ctx: RoomContext): CommandResult {
  if (typeof command.nickname !== "string") {
    return reject("invalid-nickname", "Please choose a nickname.");
  }
  const id = `p${state.nextPlayerNumber++}`;
  const reconnectToken = ctx.newToken();
  state.people.push({ id, nickname: command.nickname, reconnectToken, connected: true, disconnectedAt: null });
  state.hostId ??= id;
  return { ok: true, playerId: id, reconnectToken };
}
