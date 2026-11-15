import type { PasswordPolicy } from "@ecomweb/sdk";

/**
 * The store's password rules, shared by every place a shopper can set a
 * password (the login/register form and the checkout "create an account"
 * option). The policy is per-store and comes from the public auth config, so
 * nothing here may hardcode a minimum length.
 *
 * The backend enforces the same rules and rejects a bad password with
 * `AUTH_WEAK_PASSWORD`; validating here only spares the shopper a round trip.
 */

export function getPasswordPolicyHints(policy: PasswordPolicy): string[] {
  const hints = [`Tối thiểu ${policy.min_length} ký tự`];
  if (policy.require_uppercase) hints.push("ít nhất 1 chữ hoa");
  if (policy.require_number) hints.push("ít nhất 1 chữ số");
  if (policy.require_symbol) hints.push("ít nhất 1 ký tự đặc biệt");
  return hints;
}

/**
 * Returns a Vietnamese validation message, or `null` when the password
 * satisfies the store's policy.
 */
export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicy
): string | null {
  if (!password) return "Vui lòng nhập mật khẩu";

  const unmet: string[] = [];
  if (password.length < policy.min_length) {
    unmet.push(`tối thiểu ${policy.min_length} ký tự`);
  }
  if (policy.require_uppercase && !/[A-Z]/.test(password)) {
    unmet.push("ít nhất 1 chữ hoa");
  }
  if (policy.require_number && !/[0-9]/.test(password)) {
    unmet.push("ít nhất 1 chữ số");
  }
  if (policy.require_symbol && !/[^A-Za-z0-9]/.test(password)) {
    unmet.push("ít nhất 1 ký tự đặc biệt");
  }

  return unmet.length ? `Mật khẩu cần: ${unmet.join(", ")}` : null;
}
