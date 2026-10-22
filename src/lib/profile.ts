import { z } from "zod";
import { parseHouse, type House } from "@/lib/owl-post/houses";

export const NAME_MAX_LENGTH = 80;

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  house: House | null;
};

export type ProfileFormState = {
  error?: string;
  success?: string;
  fields?: { first_name?: string; last_name?: string; avatar?: string; house?: string };
};

const profileSchema = z.object({
  id: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  avatar_path: z.string().nullable(),
  house: z.unknown().transform((value) => parseHouse(value)),
});

/** Parses a `profiles` row; an unrecognized house reads as "not chosen yet". */
export function parseProfile(row: unknown): Profile | null {
  const parsed = profileSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

type CompletionFields = Pick<Profile, "first_name" | "last_name" | "house">;
export type CompleteProfile<T extends CompletionFields> = T & { first_name: string; last_name: string; house: House };

export function isProfileComplete<T extends CompletionFields>(profile: T | null): profile is CompleteProfile<T> {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim() && profile?.house);
}

/** Where a profile stands: no name yet, a name but no house (from before the House Cup), or complete. */
export type ProfileStep = "name" | "house" | "edit";

export function profileStep(profile: CompletionFields | null): ProfileStep {
  if (isProfileComplete(profile)) return "edit";
  return profile?.first_name?.trim() && profile.last_name?.trim() ? "house" : "name";
}

/** The letter on your avatar when there's no photo. Code points keep emoji and CJK whole. */
export function initialOf(name: string) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase("en-US") ?? "?";
}

/** The byline shown on public posts: "Tristan R." Code points keep emoji and CJK initials whole. */
export function publicName(profile: { first_name: string; last_name: string }) {
  const initial = Array.from(profile.last_name.trim())[0];
  return `${profile.first_name.trim()} ${initial}.`;
}

export function validateProfileNames(formData: FormData) {
  const fields: NonNullable<ProfileFormState["fields"]> = {};
  const names = { first_name: "", last_name: "" };

  for (const field of ["first_name", "last_name"] as const) {
    const raw = formData.get(field);
    const value = typeof raw === "string" ? raw.trim() : "";
    names[field] = value;

    if (!value) {
      fields[field] = `Add your ${field === "first_name" ? "first" : "last"} name.`;
    } else if (value.length > NAME_MAX_LENGTH) {
      fields[field] = `Use ${NAME_MAX_LENGTH} characters or fewer.`;
    }
  }

  return { names, fields, valid: Object.keys(fields).length === 0 };
}
