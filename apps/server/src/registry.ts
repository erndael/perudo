// Room registry: creates Rooms with short codes and routes commands to them by code.
// Pure like the Room module: RNG and clock injected.
import type { Clock, Rng } from "./deps.ts";
import { createRoom, type Room } from "./room/index.ts";

/** No O/0 or I/1, so codes can be read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export interface Registry {
  create(): Room;
  get(code: string): Room | undefined;
}

export function createRegistry(deps: { rng: Rng; clock: Clock }): Registry {
  const rooms = new Map<string, Room>();

  const newCode = () => {
    let code: string;
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[deps.rng(CODE_ALPHABET.length)]).join("");
    } while (rooms.has(code));
    return code;
  };

  return {
    create() {
      const room = createRoom({ code: newCode(), rng: deps.rng, clock: deps.clock });
      rooms.set(room.code, room);
      return room;
    },
    get(code) {
      return rooms.get(code);
    },
  };
}
