// Image generation costs real money, so both limits are checked before calling Gemini.
export const USER_DAILY_LIMIT = 3;
export const GLOBAL_DAILY_LIMIT = 100;

export type QuotaDecision =
  | { allowed: true; remainingAfter: number }
  | { allowed: false; reason: "user" | "global"; message: string };

export function quotaDecision(usedByUser: number, usedGlobally: number): QuotaDecision {
  if (usedByUser >= USER_DAILY_LIMIT) {
    return { allowed: false, reason: "user", message: `You've sent all ${USER_DAILY_LIMIT} owls for today. Fresh owls arrive at midnight.` };
  }
  if (usedGlobally >= GLOBAL_DAILY_LIMIT) {
    return { allowed: false, reason: "global", message: "Every owl in the Owlery is out on delivery. Try again tomorrow." };
  }
  return { allowed: true, remainingAfter: USER_DAILY_LIMIT - usedByUser - 1 };
}

export function remainingToday(usedByUser: number) {
  return Math.max(0, USER_DAILY_LIMIT - usedByUser);
}
