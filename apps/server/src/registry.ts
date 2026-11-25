// Room registry: creates Rooms with short codes and routes commands to them by code.
// Pure like the Room module: RNG and clock injected.
import type { Clock, Rng } from "./deps.ts";
import { createRoom, type Room } from "./room/index.ts";

/** No O/0 or I/1, so codes can be read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
/** A Room is deleted this long after it becomes empty. */
export const ROOM_EXPIRY_MS = 10 * 60_000;

export interface Registry {
  create(): Room;
  /** Undefined for a code that was never created or whose Room has expired. */
  get(code: string): Room | undefined;
  /** Deletes every expired Room and returns their codes. The server calls this periodically. */
  sweep(): string[];
}

export interface RegistryDeps {
  /** For Room codes; also each Room's RNG unless `newRoomRng` is given. */
  rng: Rng;
  clock: Clock;
  /** Called once per new Room for the RNG that rolls its dice (seeded per Room in test mode). */
  newRoomRng?: () => Rng;
}

export function createRegistry(deps: RegistryDeps): Registry {
  const newRoomRng = deps.newRoomRng ?? (() => deps.rng);
  const rooms = new Map<string, Room>();

  const newCode = () => {
    let code: string;
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[deps.rng(CODE_ALPHABET.length)]).join("");
    } while (rooms.has(code));
    return code;
  };

  const isExpired = (room: Room) => {
    const since = room.emptySince();
    return since !== null && deps.clock() - since >= ROOM_EXPIRY_MS;
  };

  return {
    create() {
      const room = createRoom({ code: newCode(), rng: newRoomRng(), clock: deps.clock });
      rooms.set(room.code, room);
      return room;
    },
    get(code) {
      const room = rooms.get(code);
      if (room && isExpired(room)) {
        rooms.delete(code);
        return undefined;
      }
      return room;
    },
    sweep() {
      const expired = [...rooms.values()].filter(isExpired).map((room) => room.code);
      for (const code of expired) rooms.delete(code);
      return expired;
    },
  };
}
