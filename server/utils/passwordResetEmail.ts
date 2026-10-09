import { brandedEmail, EMAIL_SIGN_OFF, emailGreeting } from "./emailLayout";

/** Firebase owns the reset credential; the existing layout owns the email brand. */
export function passwordResetEmail(resetLink: string) {
  const url = new URL(resetLink);
  if (url.protocol !== "https:" || url.username || url.password
    || url.searchParams.get("mode") !== "resetPassword" || !url.searchParams.get("oobCode"))
    throw new Error("password_reset_link_invalid");
  const subject = "Reset your Blueprint password";
  return { subject, ...brandedEmail({ subject, text: [
    emailGreeting(), "",
    "Use this link to choose a new password for your Blueprint account.", "",
    `Reset password:\n${url.toString()}`, "",
    "If you didn’t ask to reset your password, you can ignore this email. Your password will stay the same.", "",
    EMAIL_SIGN_OFF,
  ].join("\n") }) };
}
