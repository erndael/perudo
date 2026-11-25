import { reject, type CommandResult, type RoomState } from "../types.ts";

export interface JoinCommand {
  type: "join";
  nickname: string;
}

export function join(state: RoomState, command: JoinCommand): CommandResult {
  if (typeof command.nickname !== "string") {
    return reject("invalid-nickname", "Please choose a nickname.");
  }
  const id = `p${state.nextPlayerNumber++}`;
  state.people.push({ id, nickname: command.nickname });
  state.hostId ??= id;
  return { ok: true, playerId: id };
}
