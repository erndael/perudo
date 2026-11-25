// Room registry: creates Rooms with short codes and routes commands to them by code.
// Pure like the Room module: RNG and clock injected.
import type { Clock, Rng } from "./deps.ts";
import { createRoom, type Room } from "./room/index.ts";

/** No O/0 or I/1, so codes can be read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** 22 characters of 62 is about 131 bits: unguessable when `rng` is secure. */
const TOKEN_LENGTH = 22;

export interface Registry {
  create(): Room;
  get(code: string): Room | undefined;
}

export interface RegistryDeps {
  /** For Room codes and reconnect tokens; also each Room's RNG unless `newRoomRng` is given. */
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

  // Drawn from `deps.rng`, never a Room's dice RNG: tokens stay secret in test mode
  // and joining doesn't shift the seeded dice.
  const newToken = () =>
    Array.from({ length: TOKEN_LENGTH }, () => TOKEN_ALPHABET[deps.rng(TOKEN_ALPHABET.length)]).join("");

  return {
    create() {
      const room = createRoom({ code: newCode(), rng: newRoomRng(), clock: deps.clock, newToken });
      rooms.set(room.code, room);
      return room;
    },
    get(code) {
      return rooms.get(code);
    },
  };
}
