// @vitest-environment node
/**
 * The start form checks an email address in the browser before anything is sent, with the same rule the server
 * applies. This table is the contract: the browser check (`checkEmail`) and the server's format check
 * (`isValidEmailAddress`) agree on every address, and the route answers each refusal with the same reason (see
 * server/tests/inbound-request.test.ts, "answers an email it cannot send to").
 */
import { describe, expect, it } from "vitest";

import { checkEmail, EMAIL_REFUSAL_SENTENCES, type EmailRefusal } from "@/lib/emailAddress";
import { isValidEmailAddress } from "../../../server/utils/validation";

const EMAIL_TABLE: Array<[string, EmailRefusal | "ok"]> = [
  ["yeet@gmail.com", "gmail_name_length"],
  ["yeeter@gmail.com", "ok"],
  ["yeet@outlook.com", "ok"],
  ["yeet@mailinator.com", "temporary_address"],
  ["owner@yopmail.com", "temporary_address"],
  ["abcdefghijklmnopqrstuvwxyz12345@gmail.com", "gmail_name_length"],
  ["yeeter+jobs@gmail.com", "ok"],
  ["yeet+longertag@gmail.com", "gmail_name_length"],
  ["yeeter@googlemail.com", "ok"],
  ["yeet@googlemail.com", "gmail_name_length"],
  ["a.b.c.d.e@gmail.com", "gmail_name_length"],
  ["YEETER@GMAIL.COM", "ok"],
  ["Yeet@Outlook.com", "ok"],
  ["  yeeter@gmail.com ", "ok"],
  ["jöhn@example.com", "invalid"],
  ["owner@example", "invalid"],
  ["yee_ter@gmail.com", "invalid"],
  ["plainaddress", "invalid"],
  ["", "invalid"],
];

describe("one email rule for the browser and the server", () => {
  it.each(EMAIL_TABLE)("%s → %s", (address, expected) => {
    const checked = checkEmail(address);
    expect(checked.ok ? "ok" : checked.reason).toBe(expected);
    // The server format check, on the address as the form sends it (trimmed, lower case).
    const formatOk = expected === "ok" || expected === "temporary_address";
    expect(isValidEmailAddress(address.trim().toLowerCase())).toBe(formatOk);
  });

  it("says each refusal plainly", () => {
    expect(EMAIL_REFUSAL_SENTENCES).toEqual({
      gmail_name_length: "Gmail addresses have 6 to 30 letters or numbers before @gmail.com. Check yours.",
      temporary_address: "We can't send to a temporary email address. Use one you check.",
      invalid: "Check your email address.",
    });
  });
});
