/** Each cast member keeps the card hue they had in the original letter gallery. */
export function characterHue(sortOrder: number) {
  return (sortOrder * 41 + 14) % 360;
}

type WritingCharacter = { name: string | null; appearance: string | null; is_active: boolean };

/** Retired characters remain in the cast for old posts, but cannot write new ones. */
export function isAvailableWriter<T extends WritingCharacter>(character: T): character is T & { name: string; appearance: string } {
  return character.is_active && Boolean(character.name?.trim()) && Boolean(character.appearance?.trim());
}
