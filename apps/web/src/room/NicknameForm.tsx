import { useState, type FormEvent } from "react";

export function NicknameForm(props: { onSubmit(nickname: string): void; error: string | null }) {
  const [nickname, setNickname] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmit(nickname.trim());
  };

  return (
    <form onSubmit={submit}>
      <label>
        Nickname
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={16} autoFocus />
      </label>
      <button type="submit" disabled={nickname.trim() === ""}>
        Join
      </button>
      {props.error && <p role="alert">{props.error}</p>}
    </form>
  );
}
