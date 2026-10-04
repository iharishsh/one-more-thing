import { nanoid } from "nanoid";

export function createProposalToken() {
  return nanoid(32);
}
