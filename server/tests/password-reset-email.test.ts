// @vitest-environment node
import { describe, expect, it } from "vitest";
import { passwordResetEmail } from "../utils/passwordResetEmail";
describe("password reset email", () => {
  it("uses the shared brand and one Firebase reset link in both parts", () => {
    const link = "https://blueprint-8c1ca.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=fixture-only&continueUrl=https%3A%2F%2Ftryblueprint.io%2Fsign-in";
    const email = passwordResetEmail(link);
    expect(email.subject).toBe("Reset your Blueprint password");
    expect(email.text).toContain(link);
    expect(email.html).toContain('/brand/email-mark.png');
    expect(email.html).toContain('>Reset password</a>');
    expect(email.html).toContain('mode=resetPassword&amp;oobCode=fixture-only');
    expect(email.html).toContain('6801 Burnet Rd, Austin');
    expect(email.text).toContain('ignore this email');
    expect(email.html).not.toContain('Unsubscribe');
  });
  it.each(["http://example.test/?mode=resetPassword&oobCode=code", "https://example.test/?mode=verifyEmail&oobCode=code", "https://example.test/?mode=resetPassword", "https://user:pass@example.test/?mode=resetPassword&oobCode=code"])("rejects an invalid reset action %s", link => {
    expect(() => passwordResetEmail(link)).toThrow("password_reset_link_invalid");
  });
});
