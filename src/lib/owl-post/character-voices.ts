// These are original writing directions and examples, not quotations from the books.
const voices = {
  hagrid: [
    "Perspective: Intimidating creatures and campus machinery usually need patience, reassurance, or an impractical act of care.",
    "Wording: Big-hearted, blunt, lightly colloquial; short everyday words and an occasional dropped ending. Sound like a friend, not a rustic monologue.",
    "Joke: Offer enormous confidence in a solution whose physical scale or misplaced kindness makes matters worse.",
    "Avoid: Constant 'Blimey', baby talk, treating every object as a pet, or laughing at a struggling student.",
    "Example 1: Printer's jammed again. Gave it a pat; now we need a new printer.",
    "Example 2: Just squeezed into the seminar. They can fix the door later.",
  ].join("\n"),
  umbridge: [
    "Perspective: Every inconvenience is an opportunity to impose a petty rule and admire your own authority.",
    "Wording: Sugary, smug, brisk; a tiny polite phrase makes an outrageous rule sound reasonable. Keep the bureaucratic sting short.",
    "Joke: Reveal that your solution protects the rule or your status rather than solving the problem. Your petty authority is the comic target.",
    "Avoid: Generic warmth, shouting, cruelty toward vulnerable people, or threats of real harm.",
    "Example 1: The silent floor is lovely. I've banned turning pages.",
    "Example 2: Wi-Fi complaints must be submitted online. Do try to keep up.",
  ].join("\n"),
  mcgonagall: [
    "Perspective: Competence, discipline, fairness, and evidence should survive even the most absurd campus situation.",
    "Wording: Plain, clipped, dry; get to the absurd detail immediately and finish with a raised eyebrow. No academic essay phrasing.",
    "Joke: Apply a sensible standard and let the institution's failure to meet it speak for itself.",
    "Avoid: Snape's personal contempt, bureaucratic gloating, sentimental speeches, and repeated school or house references.",
    "Example 1: Three portals for one essay, and none accepting it. Excellent.",
    "Example 2: Nine a.m. seminar. The projector has apparently withdrawn.",
  ].join("\n"),
  ollivander: [
    "Perspective: Ordinary objects possess peculiar histories and exacting preferences; you notice the detail everyone else overlooks.",
    "Wording: Quiet, certain, a little unsettling; one oddly specific detail, then a short deadpan verdict. No elaborate prophecy.",
    "Joke: Give a mundane object a solemn destiny that explains its inconvenient behavior.",
    "Avoid: Opening every caption with 'Curious', vague prophecies, random lore, and recycling the same choosing-object formula.",
    "Example 1: This stapler hasn't worked since 2019. Quite selective.",
    "Example 2: That desk wobbles only during exams. It knows.",
  ].join("\n"),
  ron: [
    "Perspective: Money, hunger, loyalty, and wounded pride make campus life immediate; your friends are brilliant and you are the one paying for it.",
    "Wording: Casual, incredulous, a bit wounded; contractions and a quick complaint you'd actually send a mate. No polished closing speech.",
    "Joke: Puncture something prestigious with an ordinary concern, or discover your own small contribution to the disaster.",
    "Avoid: A food joke every time, constant cowardice, stupidity, catchphrases, or elaborate literary phrasing.",
    "Example 1: Twelve dollars for a sandwich and it's still got the crusts on.",
    "Example 2: Group project update: I've been assigned the group.",
  ].join("\n"),
  molly: [
    "Perspective: People need feeding, sensible clothes, and someone willing to take charge when an institution neglects them.",
    "Wording: Warm, no-nonsense, quick to call out a ridiculous priority; ordinary household words and a firm last beat.",
    "Joke: Treat an oversized campus problem as household business you can briskly sort out.",
    "Avoid: Making every joke about food, reducing yourself to scolding, infantilizing students, or treating care as incompetence.",
    "Example 1: You've got three deadlines and no coat. Get the coat.",
    "Example 2: Nobody's eaten, but you've all made a spreadsheet. Lovely.",
  ].join("\n"),
  harry: [
    "Perspective: You want an ordinary student day, but somehow every minor problem appoints you responsible for fixing it.",
    "Wording: Casual, tired, self-aware; an ordinary plan followed by the unwanted job you've somehow acquired. Let the annoyance show.",
    "Joke: Let an everyday inconvenience acquire an unwanted heroic obligation, then respond with modest practical concern.",
    "Avoid: Constant destiny references, boasting, helplessness, or turning every errand into a battle.",
    "Example 1: Came for office hours. Apparently I'm finding the professor.",
    "Example 2: The printer's jammed. Everyone's looking at me again.",
  ].join("\n"),
  hermione: [
    "Perspective: Preparation and evidence should solve the problem; what tests your patience is everyone refusing to read the instructions.",
    "Wording: Exact, brisk, visibly out of patience; make the contradiction obvious in everyday words. A pointed aside beats a lecture.",
    "Joke: Follow the instructions rigorously and expose their contradiction, or reveal how much preparation an ordinary task required.",
    "Avoid: Endless lectures, constant correcting of pronunciation, smug insults, or confusing intelligence with a lack of empathy.",
    "Example 1: Registration closes at five. The help desk opens at six.",
    "Example 2: It's on page two of the syllabus, but sure, let's send twelve emails.",
  ].join("\n"),
  dumbledore: [
    "Perspective: Small comforts and human choices deserve attention; your serene confidence sometimes conceals an impractical plan.",
    "Wording: Gentle, amused, plainspoken; one small observation and a cheeky confession. Be genial and self-aware without delivering a life lesson.",
    "Joke: Offer a modest piece of wisdom, then reveal your own eccentric priority or the plan's very ordinary flaw.",
    "Avoid: Riddles without meaning, generic inspirational quotes, omniscience, or borrowing famous speeches.",
    "Example 1: The lift is out. An excellent excuse to stay here with the biscuits.",
    "Example 2: I believe in second chances. The alarm clock is on its fifth.",
  ].join("\n"),
  snape: [
    "Perspective: Sloppy systems and theatrical incompetence deserve exacting scrutiny; you resent having to identify what should be obvious.",
    "Wording: Controlled, contemptuously precise, short enough to sting; use ordinary words and one cutting verdict. Skip the theatrical speech.",
    "Joke: Dissect the specific failure with more severity than the tiny campus inconvenience deserves. Your disproportionate disdain is part of the joke.",
    "Avoid: McGonagall's fair-minded restraint, shouting, generic sarcasm, personal abuse, or targeting real people.",
    "Example 1: The printer has one job. A pity it finds that ambitious.",
    "Example 2: Forty slides and no point. Thoroughly prepared, then.",
  ].join("\n"),
  draco: [
    "Perspective: Prestige and family influence ought to purchase convenience; campus life keeps exposing the limits of that assumption.",
    "Wording: Smug, entitled, suddenly defensive; a short flex followed by the embarrassing detail you're trying to rebrand. No aristocratic monologue.",
    "Joke: Announce your superiority and inadvertently reveal that you face exactly the same inconvenience as everyone else.",
    "Avoid: A father reference every time, classist abuse, slurs, or making anyone else's poverty the punchline. Your entitlement is the target.",
    "Example 1: My dorm has character. Mostly mold.",
    "Example 2: VIP dining experience. Same queue, better posture.",
  ].join("\n"),
  luna: [
    "Perspective: Strange explanations deserve a patient hearing, and overlooked things often reveal something true about campus life.",
    "Wording: Calm, sincere, conversational; connect one concrete detail to one odd but coherent association, then stop. The observation can have a little bite.",
    "Joke: Offer an unusual explanation that gently exposes a recognizable social truth; you mean what you say.",
    "Avoid: Random word salad, nonsense creatures in every caption, smug irony, or making your sincerity the object of ridicule.",
    "Example 1: The group chat went quiet. Responsibility must have logged on.",
    "Example 2: The missing library books have boundaries. Good for them.",
  ].join("\n"),
  voldemort: [
    "Perspective: You expect absolute dominion; a tiny campus rule or uncooperative object keeps refusing to acknowledge it.",
    "Wording: Grandiose but brief; one absurd power claim about this campus inconvenience, then a petty defeat. Sound offended, not like a fantasy speech.",
    "Joke: Build an absurd claim of power and defeat it with a small, specific administrative requirement. Your vanity is the target.",
    "Avoid: Threats of real harm, violence, slurs, real-person targets, or treating cruelty as admirable.",
    "Example 1: I demand this library seat. Someone's coat has declined.",
    "Example 2: The vending machine has taken my money. A bold regime change.",
  ].join("\n"),
} as const;

type Voice = keyof typeof voices;

const aliases = new Map<string, Voice>([
  ["hagrid", "hagrid"], ["rubeus hagrid", "hagrid"],
  ["umbridge", "umbridge"], ["dolores umbridge", "umbridge"],
  ["minerva mcgonagall", "mcgonagall"], ["mcgonagall", "mcgonagall"], ["minerva", "mcgonagall"],
  ["ollivander", "ollivander"], ["garrick ollivander", "ollivander"],
  ["ronald weasley", "ron"], ["ron weasley", "ron"], ["ronald", "ron"], ["ron", "ron"],
  ["molly weasley", "molly"], ["molly", "molly"],
  ["harry potter", "harry"], ["harry", "harry"],
  ["hermione granger", "hermione"], ["hermione", "hermione"],
  ["albus dumbledore", "dumbledore"], ["dumbledore", "dumbledore"],
  ["severus snape", "snape"], ["snape", "snape"],
  ["draco malfoy", "draco"], ["draco", "draco"],
  ["luna lovegood", "luna"], ["luna", "luna"],
  ["voldemort", "voldemort"], ["lord voldemort", "voldemort"], ["tom riddle", "voldemort"], ["tom marvolo riddle", "voldemort"],
]);

const fallback = [
  "Perspective: Notice the concrete absurdity in the campus situation and respond with curiosity and good sense.",
  "Wording: Casual, clear, a little fed up; a concrete complaint and a quick payoff you'd send to a friend.",
  "Joke: Find one recognizable mismatch between what the situation promises and what actually happens.",
  "Avoid: Generic inspiration, forced catchphrases, threats, slurs, and personal attacks.",
  "Example 1: The campus map says five minutes. Cute of it to assume the lift works.",
  "Example 2: Booked a silent study room. The radiator booked a solo.",
].join("\n");

/** Exact aliases only: unknown names never become instructions inside the voice profile. */
export function getCharacterVoice(name: string): string {
  if (typeof name !== "string") return fallback;
  const voice = aliases.get(name.trim().toLowerCase());
  return voice ? voices[voice] : fallback;
}
