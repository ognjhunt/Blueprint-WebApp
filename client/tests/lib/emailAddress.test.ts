// @vitest-environment node
/**
 * The start form checks an email address in the browser before anything is sent, with the rule its route applies.
 * Three outcomes (owner, 2026-11-11: refuse only what we know is wrong): accepted, accepted with a hint under the
 * field, refused. The route answers the same table the same way (server/tests/inbound-request.test.ts, "an email it
 * cannot send to").
 */
import { describe, expect, it } from "vitest";

import { checkEmail, EMAIL_HINT_SENTENCES, EMAIL_REFUSAL_SENTENCES } from "@/lib/emailAddress";
import { isValidEmailAddress } from "../../../server/utils/validation";

type Outcome = "accepted" | "hint" | "temporary_address" | "invalid";
const EMAIL_TABLE: Array<[string, Outcome]> = [
  ["yeet@gmail.com", "hint"],
  ["yeeter@gmail.com", "accepted"],
  ["yeet@outlook.com", "accepted"],
  ["yeet@mailinator.com", "temporary_address"],
  ["owner@yopmail.com", "temporary_address"],
  ["abcdefghijklmnopqrstuvwxyz12345@gmail.com", "hint"],
  ["yeeter+jobs@gmail.com", "accepted"],
  ["yeet+longertag@gmail.com", "hint"],
  ["yeeter@googlemail.com", "accepted"],
  ["yeet@googlemail.com", "hint"],
  // Eleven characters counted as Google's help page counts them (periods included): no hint.
  ["a.b.c.d.e.f@gmail.com", "accepted"],
  ["a.b.c@gmail.com", "hint"],
  ["YEETER@GMAIL.COM", "accepted"],
  ["Yeet@Outlook.com", "accepted"],
  ["  yeeter@gmail.com ", "accepted"],
  // Well formed; Gmail's own character rule is not ours to enforce.
  ["yee_ter@gmail.com", "accepted"],
  ["jöhn@example.com", "invalid"],
  ["owner@example", "invalid"],
  ["plainaddress", "invalid"],
  ["", "invalid"],
];

describe("one email rule for the browser and the start form's route", () => {
  it.each(EMAIL_TABLE)("%s → %s", (address, expected) => {
    const checked = checkEmail(address);
    expect(checked.ok ? (checked.hint ? "hint" : "accepted") : checked.reason).toBe(expected);
  });

  it("says each refusal and the hint plainly", () => {
    expect(EMAIL_REFUSAL_SENTENCES).toEqual({
      temporary_address: "We can't send to a temporary email address. Use one you check.",
      invalid: "Check your email address.",
    });
    expect(EMAIL_HINT_SENTENCES).toEqual({
      gmail_name_length: "Gmail names are usually 6 to 30 characters. Check it's right; we send your job link there.",
    });
  });

  // Other callers (contact, waitlist, approved robot-team emails) keep their stricter check, with the Gmail rule.
  it.each([["yeet@gmail.com", false], ["yeeter@gmail.com", true], ["yeet@mailinator.com", true], ["owner@example", false]] as const)(
    "keeps the stricter check for other callers (%s → %s)", (address, valid) => {
      expect(isValidEmailAddress(address)).toBe(valid);
    });
});
