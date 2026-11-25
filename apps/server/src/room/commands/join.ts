import { MAX_PLAYERS } from "@perudo/engine";
import { reject, type CommandResult, type RoomContext, type RoomState } from "../types.ts";

export interface JoinCommand {
  type: "join";
  nickname: string;
  /** The Room's host key, presented by whoever created the Room (see `Room.hostKey`). */
  hostKey?: string;
}

/** Everyone in the Room counts, including people waiting for the next Game. */
export const ROOM_CAPACITY = MAX_PLAYERS;
/** Counted in characters (code points) after trimming surrounding spaces. */
export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 16;

export function join(state: RoomState, command: JoinCommand, ctx: RoomContext): CommandResult {
  if (typeof command.nickname !== "string") {
    return reject("invalid-nickname", "Please choose a nickname.");
  }
  if (state.people.length >= ROOM_CAPACITY) {
    return reject("room-full", `Room full: this Room already has ${ROOM_CAPACITY} people.`);
  }
  const nickname = command.nickname.trim();
  const length = [...nickname].length;
  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
    return reject(
      "invalid-nickname",
      `Please choose a nickname of ${NICKNAME_MIN_LENGTH}–${NICKNAME_MAX_LENGTH} characters.`,
    );
  }
  // Departed players' nicknames still show in the Game (Seats, the reveal), so they're taken too.
  const key = nickname.toLocaleLowerCase();
  if ([...state.people, ...state.departed].some((p) => p.nickname.toLocaleLowerCase() === key)) {
    return reject("nickname-taken", `“${nickname}” is already taken in this Room. Please choose another nickname.`);
  }
  const id = `p${state.nextPlayerNumber++}`;
  const reconnectToken = ctx.newToken();
  state.people.push({ id, nickname, reconnectToken, connected: true, disconnectedAt: null });
  if (state.hostKey !== null && command.hostKey === state.hostKey) {
    state.hostId = id;
    state.hostKey = null;
  } else {
    state.hostId ??= id;
  }
  return { ok: true, playerId: id, reconnectToken };
}
