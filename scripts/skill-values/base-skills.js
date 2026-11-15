/**
 * Base skill values: the one table Rollbox uses for skills missing from a character's sheet.
 * Source: Keeper Rulebook, Chapter 4, skill list p. 56, with the specialisation lists on pp. 59
 * (Art and Craft), 64 (Fighting, Firearms) and 73-75 (Science). Uncommon skills (marked T on p. 56)
 * and Modern-era skills (marked Ω) are tagged for information only: every skill is always offered,
 * whatever the era, because games move between eras (Void's decision, 2026-11-13).
 *
 * Names are written the way CoC7's sheets and Skills compendium write them ("Art/Craft (Acting)",
 * "Firearms (Handgun)"), because requests go to CoC7 by name. `cocid` is CoC7's skill id, which is the
 * same in every language and is matched first. Differences from CoC7's compendium are listed in
 * docs/skill-values.md.
 */

/** Base value worked out from a characteristic: Dodge is half DEX (p. 63), Language (Own) is EDU (p. 67). */
const HALF_DEX = Object.freeze({ characteristic: "dex", divisor: 2 });
const EDU = Object.freeze({ characteristic: "edu", divisor: 1 });

const skill = (name, base, cocid, extra = {}) => Object.freeze({ name, base, cocid, ...extra });
const UNCOMMON = { uncommon: true };
const MODERN = { modern: true };

/** Every skill on the p. 56 list that has a fixed name, A–Z. */
export const BASE_SKILLS = Object.freeze([
  skill("Accounting", 5, "i.skill.accounting"),
  skill("Animal Handling", 5, "i.skill.animal-handling", UNCOMMON),
  skill("Anthropology", 1, "i.skill.anthropology"),
  skill("Appraise", 5, "i.skill.appraise"),
  skill("Archaeology", 1, "i.skill.archaeology"),
  skill("Art/Craft (Acting)", 5, "i.skill.art-craft-acting"),
  skill("Art/Craft (Fine Art)", 5, "i.skill.art-craft-fine-art"),
  skill("Art/Craft (Forgery)", 5, "i.skill.art-craft-forgery"),
  skill("Art/Craft (Photography)", 5, "i.skill.art-craft-photography"),
  skill("Charm", 15, "i.skill.charm"),
  skill("Climb", 20, "i.skill.climb"),
  skill("Computer Use", 5, "i.skill.computer-use", MODERN),
  skill("Credit Rating", 0, "i.skill.credit-rating"),
  skill("Cthulhu Mythos", 0, "i.skill.cthulhu-mythos"),
  skill("Demolitions", 1, "i.skill.demolitions", UNCOMMON),
  skill("Disguise", 5, "i.skill.disguise"),
  skill("Diving", 1, "i.skill.diving", UNCOMMON),
  skill("Dodge", HALF_DEX, "i.skill.dodge"),
  skill("Drive Auto", 20, "i.skill.drive-auto"),
  skill("Electrical Repair", 10, "i.skill.electrical-repair"),
  skill("Electronics", 1, "i.skill.electronics", MODERN),
  skill("Fast Talk", 5, "i.skill.fast-talk"),
  skill("Fighting (Axe)", 15, "i.skill.fighting-axe"),
  skill("Fighting (Brawl)", 25, "i.skill.fighting-brawl"),
  skill("Fighting (Chainsaw)", 10, "i.skill.fighting-chainsaw"),
  skill("Fighting (Flail)", 10, "i.skill.fighting-flail"),
  skill("Fighting (Garrote)", 15, "i.skill.fighting-garrote"),
  skill("Fighting (Spear)", 20, "i.skill.fighting-spear"),
  skill("Fighting (Sword)", 20, "i.skill.fighting-sword"),
  skill("Fighting (Whip)", 5, "i.skill.fighting-whip"),
  // p. 56 and p. 59 list "Artillery" as its own uncommon skill; CoC7 files it under Firearms.
  skill("Firearms (Artillery)", 1, "i.skill.firearms-artillery", UNCOMMON),
  skill("Firearms (Bow)", 15, "i.skill.firearms-bow"),
  skill("Firearms (Flamethrower)", 10, "i.skill.firearms-flamethrower"),
  skill("Firearms (Handgun)", 20, "i.skill.firearms-handgun"),
  skill("Firearms (Heavy Weapons)", 10, "i.skill.firearms-heavy-weapons"),
  skill("Firearms (Machine Gun)", 10, "i.skill.firearms-machine-gun"),
  skill("Firearms (Rifle/Shotgun)", 25, "i.skill.firearms-rifle-shotgun"),
  skill("Firearms (Submachine Gun)", 15, "i.skill.firearms-submachine-gun"),
  skill("First Aid", 30, "i.skill.first-aid"),
  skill("History", 5, "i.skill.history"),
  skill("Hypnosis", 1, "i.skill.hypnosis", UNCOMMON),
  skill("Intimidate", 15, "i.skill.intimidate"),
  skill("Jump", 20, "i.skill.jump"),
  skill("Language (Own)", EDU, "i.skill.language-own"),
  skill("Law", 5, "i.skill.law"),
  skill("Library Use", 20, "i.skill.library-use"),
  skill("Listen", 20, "i.skill.listen"),
  skill("Locksmith", 1, "i.skill.locksmith"),
  skill("Mechanical Repair", 10, "i.skill.mechanical-repair"),
  skill("Medicine", 1, "i.skill.medicine"),
  skill("Natural World", 10, "i.skill.natural-world"),
  skill("Navigate", 10, "i.skill.navigate"),
  skill("Occult", 5, "i.skill.occult"),
  skill("Operate Heavy Machinery", 1, "i.skill.operate-heavy-machinery"),
  skill("Persuade", 10, "i.skill.persuade"),
  skill("Psychoanalysis", 1, "i.skill.psychoanalysis"),
  skill("Psychology", 10, "i.skill.psychology"),
  skill("Read Lips", 1, "i.skill.read-lips", UNCOMMON),
  skill("Ride", 5, "i.skill.ride"),
  skill("Science (Astronomy)", 1, "i.skill.science-astronomy"),
  skill("Science (Biology)", 1, "i.skill.science-biology"),
  skill("Science (Botany)", 1, "i.skill.science-botany"),
  skill("Science (Chemistry)", 1, "i.skill.science-chemistry"),
  skill("Science (Cryptography)", 1, "i.skill.science-cryptography"),
  skill("Science (Engineering)", 1, "i.skill.science-engineering"),
  skill("Science (Forensics)", 1, "i.skill.science-forensics"),
  skill("Science (Geology)", 1, "i.skill.science-geology"),
  skill("Science (Mathematics)", 10, "i.skill.science-mathematics"),
  skill("Science (Meteorology)", 1, "i.skill.science-meteorology"),
  skill("Science (Pharmacy)", 1, "i.skill.science-pharmacy"),
  skill("Science (Physics)", 1, "i.skill.science-physics"),
  skill("Science (Zoology)", 1, "i.skill.science-zoology"),
  skill("Sleight of Hand", 10, "i.skill.sleight-of-hand"),
  skill("Spot Hidden", 25, "i.skill.spot-hidden"),
  skill("Stealth", 20, "i.skill.stealth"),
  skill("Swim", 20, "i.skill.swim"),
  skill("Throw", 20, "i.skill.throw"),
  skill("Track", 10, "i.skill.track")
]);

/**
 * Skills the rulebook splits into specialisations a player names freely, with no fixed list
 * (p. 56, marked G). Their base applies to any specialisation found on a sheet, such as
 * "Language (Latin)" or "Pilot (Aircraft)". They are not offered as missing skills, because a request
 * needs a specialisation's name. Fighting and Firearms are not here: their base "varies" (p. 64).
 */
export const GROUP_BASES = Object.freeze({
  "art/craft": 5, // p. 59
  "language": 1, // Language (Other), p. 66
  "lore": 1, // p. 68, uncommon
  "pilot": 1, // p. 71
  "science": 1, // p. 73
  "survival": 10 // p. 77
});
