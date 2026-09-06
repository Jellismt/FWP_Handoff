/**
 * @file loadFeesContent.ts
 * @module engage-mt/server/etl
 * @description Hand-curated seed of the license-fee chart (pp.12-13) + a starter set of
 *              reference content sections (Laws & Rules etc., pp.20-25) for a season year.
 *              Fees/content are curated (not machine-extracted) — reviewed via git diff —
 *              so they skip the staging path. Idempotent per (season_year, code/slug).
 *              Usage: `tsx src/etl/loadFeesContent.ts [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction, closePool, query } from "../db/pool.js";

const D = (dollars: number) => Math.round(dollars * 100);
const APR1 = "2026-04-01";
const JUN1 = "2026-06-01";

// product_code, display_name, kind, species, sort, applyBy(ISO|null), chartNote|null,
// [ [audience, cents, note?], ... ]. Prices transcribed verbatim from the 2026 DEA book's
// RESIDENT + NONRESIDENT License & Permit Availability Charts (printed pp.12-13). Resident
// Youth (12-17) and Senior (62+) share one printed column, so both audiences carry that value.
type Product = [string, string, string, string | null, number, string | null, string | null, [string, number, string?][]];

const FEES: Product[] = [
  // ── Prerequisites (printed p.12) ──
  ["AISPP", "Aquatic Invasive Species Prevention Pass", "PREREQUISITE", null, 1, null,
    "Required (ages 16+) in addition to a fishing license to fish in Montana. Supports the aquatic invasive species prevention and inspection program.",
    [["RES", D(2)], ["RES_YOUTH", D(2)], ["RES_SENIOR", D(2)], ["RES_DISABLED", D(2)], ["NR", D(7.5)]]],
  ["BASE_HUNT", "Base Hunting License", "PREREQUISITE", null, 2, null,
    "Prerequisite for hunting or applying for a permit or license.",
    [["RES", D(10)], ["RES_YOUTH", D(10)], ["RES_SENIOR", D(10)], ["RES_DISABLED", D(10)], ["NR", D(50)]]],
  ["CONSERVATION", "Conservation License", "PREREQUISITE", null, 3, null, "Prerequisite.",
    [["RES", D(8)], ["RES_YOUTH", D(4)], ["RES_SENIOR", D(4)], ["RES_DISABLED", D(8)], ["NR", D(10)]]],
  ["BOW_ARROW", "Bow and Arrow License", "PREREQUISITE", null, 4, null,
    "Required during the Archery Only Season for any species or to archery hunt in an Arch-Equip only area or hunting district.",
    [["RES", D(10)], ["RES_YOUTH", D(10)], ["RES_SENIOR", D(10)], ["RES_DISABLED", D(10)], ["NR", D(10)]]],
  // ── Deer (printed pp.12-13) ──
  ["DEER_GENERAL", "General Deer License", "LICENSE", "deer", 10, null,
    "Application fee only. Permit must be used in conjunction with a General Deer License. Nonresidents obtain a General Deer License through a Big Game or Deer Combination drawing.",
    [["RES", D(16)], ["RES_YOUTH", D(8)], ["RES_SENIOR", D(8)], ["RES_DISABLED", D(8)]]],
  ["DEER_PERMIT", "Deer Permit (drawing)", "PERMIT", "deer", 11, APR1, null,
    [["RES", D(5)], ["RES_YOUTH", D(5)], ["RES_SENIOR", D(5)], ["RES_DISABLED", D(5)], ["NR", D(5)]]],
  ["DEER_B_DRAW", "Deer B License (drawing)", "B_LICENSE", "deer", 12, JUN1, "Antlerless only.",
    [["RES", D(15)], ["RES_YOUTH", D(15)], ["RES_SENIOR", D(15)], ["RES_DISABLED", D(15)], ["NR", D(80)]]],
  ["DEER_B_OTC", "Deer B License (OTC)", "B_LICENSE", "deer", 13, null,
    "Over-the-counter. Antlerless only. Valid in specific district(s). Purchase beginning June 15. Nonresident Native discounted price requires certification.",
    [["RES", D(10)], ["RES_YOUTH", D(10)], ["RES_SENIOR", D(10)], ["RES_DISABLED", D(10)], ["NR", D(75)], ["NR_NATIVE", D(37.5)]]],
  // ── Elk (printed pp.12-13) ──
  ["ELK_GENERAL", "General Elk License", "LICENSE", "elk", 20, null,
    "Nonresidents obtain a General Elk License through a Big Game or Elk Combination drawing.",
    [["RES", D(20)], ["RES_YOUTH", D(10)], ["RES_SENIOR", D(10)], ["RES_DISABLED", D(10)]]],
  ["ELK_PERMIT", "Elk Permit (drawing)", "PERMIT", "elk", 21, APR1,
    "Residents must have a current-year General Elk License to apply. Elk permits are nonrefundable and must be used with a General Elk License.",
    [["RES", D(9)], ["RES_YOUTH", D(9)], ["RES_SENIOR", D(9)], ["RES_DISABLED", D(9)], ["NR", D(9)]]],
  ["ELK_B_DRAW", "Elk B License (drawing)", "B_LICENSE", "elk", 22, JUN1, "Antlerless only. Includes drawing fee.",
    [["RES", D(25)], ["RES_YOUTH", D(25)], ["RES_SENIOR", D(25)], ["RES_DISABLED", D(25)], ["NR", D(275)]]],
  ["ELK_B_OTC", "Elk B License (OTC)", "B_LICENSE", "elk", 23, null,
    "Over-the-counter. Antlerless only. Valid in specific district(s). Nonresident Native discounted price requires certification.",
    [["RES", D(20)], ["RES_YOUTH", D(20)], ["RES_SENIOR", D(20)], ["RES_DISABLED", D(20)], ["NR", D(270)], ["NR_NATIVE", D(135)]]],
  // ── Antelope (printed pp.12-13) ──
  ["ANTELOPE_ARCHERY", "900 & 399 Archery Antelope (drawing)", "LICENSE", "antelope", 30, JUN1, "Must be first and only choice.",
    [["RES", D(19)], ["RES_YOUTH", D(19)], ["RES_SENIOR", D(19)], ["RES_DISABLED", D(19)], ["NR", D(205)]]],
  ["ANTELOPE", "Antelope or Antelope B License (drawing)", "LICENSE", "antelope", 31, JUN1, null,
    [["RES", D(19)], ["RES_YOUTH", D(19)], ["RES_SENIOR", D(19)], ["RES_DISABLED", D(19)], ["NR", D(205)]]],
  ["ANTELOPE_DISABLED", "Antelope Disabled (drawing)", "LICENSE", "antelope", 32, JUN1,
    "Special disabled antelope application fee required. For information, call 406-444-2950.",
    [["RES_DISABLED", D(19)], ["NR", D(205)]]],
  // ── Nonresident combinations (printed p.13). One product per combo; the NR column is the
  //    regular drawing price, NR_NATIVE the certified-native price, and youth-sponsored /
  //    college the reduced sponsored prices ($656/$556/$380). ──
  ["NR_BG_COMBO", "Nonresident Big Game Combination", "COMBO", null, 40, APR1,
    "Drawing (April 1). Includes General Deer, General Elk, Upland Bird (excluding turkey), and Season Fishing licenses. Youth (12-17) sponsored and college-student certification available; call 406-444-2950.",
    [["NR", D(1312)], ["NR_NATIVE", D(656)], ["NR_YOUTH_SPONSORED", D(656)], ["NR_COLLEGE", D(656)]]],
  ["NR_ELK_COMBO", "Nonresident Elk Combination", "COMBO", "elk", 41, APR1,
    "Drawing (April 1). Includes General Elk, Upland Bird (excluding turkey), and Season Fishing licenses.",
    [["NR", D(1112)], ["NR_NATIVE", D(556)], ["NR_YOUTH_SPONSORED", D(556)], ["NR_COLLEGE", D(556)]]],
  ["NR_DEER_COMBO", "Nonresident Deer Combination", "COMBO", "deer", 42, APR1,
    "Drawing (April 1). Includes General Deer, Upland Bird (excluding turkey), and Season Fishing licenses.",
    [["NR", D(760)], ["NR_NATIVE", D(380)], ["NR_YOUTH_SPONSORED", D(380)], ["NR_COLLEGE", D(380)]]],
  // ── Other nonresident products (printed p.13, Nonresident Native + Shed) ──
  ["NR_SEASON_FISHING", "Season Fishing License (nonresident)", "LICENSE", null, 50, null, "$7.50 AISPP fee also required.",
    [["NR", D(50)]]],
  ["NR_UPLAND_BIRD", "Upland Bird License (nonresident)", "LICENSE", null, 51, null, "Conservation License and Base Hunting License also required.",
    [["NR", D(63.5)]]],
  ["NR_SHED_HUNTING", "Nonresident Shed Hunting License", "LICENSE", null, 52, null,
    "Required for nonresidents to hunt sheds on wildlife management areas. Nonresident access restricted for the first 7 days after the May 15 opening.",
    [["NR", D(50)]]],
  // ── Resident Sportsman's Combination + Military (printed p.12) ──
  ["SPORTSMAN_BEAR", "Sportsman's Combination (with bear)", "COMBO", null, 60, null,
    "Includes Deer, Elk, State Lands, Upland Bird (excluding turkey) & Season Fishing licenses (with black bear). Conservation, Base Hunting, and AISPP fees also required.",
    [["RES", D(79.5)], ["RES_YOUTH", D(79.5)], ["RES_SENIOR", D(79.5)], ["RES_DISABLED", D(79.5)]]],
  ["SPORTSMAN_NO_BEAR", "Sportsman's Combination (without bear)", "COMBO", null, 61, null,
    "Includes Deer, Elk, State Lands, Upland Bird (excluding turkey) & Season Fishing licenses. Conservation, Base Hunting, and AISPP fees also required.",
    [["RES", D(64.5)], ["RES_YOUTH", D(32.25)], ["RES_SENIOR", D(64.5)], ["RES_DISABLED", D(64.5)]]],
  ["MILITARY_RECOGNITION", "Military Recognition License", "LICENSE", null, 62, null,
    "Must go through certification process only at FWP offices. No cost. Conservation License included.",
    [["RES", 0], ["RES_YOUTH", 0], ["RES_SENIOR", 0], ["RES_DISABLED", 0]]],
  // ── Point + SuperTag fees (printed pp.16-17; not on the availability chart but priced fees) ──
  ["BONUS_POINT", "Bonus Point (per species/license type)", "SURCHARGE", null, 70, null,
    "Optional. Purchased at application or between July 1 and Sept 30. Deer/elk/antelope: resident $20, nonresident $25 per species.",
    [["RES", D(20)], ["NR", D(25)]]],
  ["PREFERENCE_POINT", "Nonresident Combination Preference Point", "SURCHARGE", null, 71, null,
    "Optional. Applies to the nonresident combination drawing (75% of licenses go to the most preference points; 25% to zero-point applicants). Purchasable July 1-Dec 31 if not applying.",
    [["NR", D(100)]]],
  ["SUPERTAG", "SuperTag Lottery Chance", "SURCHARGE", null, 72, null,
    "Open to residents and nonresidents. $5 per chance for deer, elk, antelope, bighorn sheep, moose, mountain goat, mountain lion. Proceeds enhance public hunting access and FWP enforcement.",
    [["RES", D(5)], ["NR", D(5)]]],
];

// slug, category, title, statute_refs, sort, body_md
type Content = [string, string, string, string | null, number, string];
const CONTENT: Content[] = [
  ["hunter-orange", "LAWS_RULES", "Hunter Orange Requirement", "MCA 87-6-414", 10,
    "Any person hunting or accompanying a hunter for deer, elk, antelope, moose, bighorn sheep, mountain goat, black bear, or mountain lion during a firearm season must wear a **minimum of 400 square inches** of hunter orange (fluorescent) material above the waist, visible at all times.\n\nArchery hunters during the Archery Only Season are exempt unless a concurrent firearm season is open in that hunting district."],
  ["evidence-of-sex", "LAWS_RULES", "Evidence of Sex", "MCA 87-6-406", 20,
    "A person who kills a game animal shall retain evidence of the sex of the animal with the carcass until it is processed. Evidence of sex does not need to be naturally attached."],
  ["hunting-hours", "LAWS_RULES", "Hunting Hours", "CR", 30,
    "Authorized hunting hours for taking game animals begin one-half hour before sunrise and end one-half hour after sunset each day of the hunting season. See the official Sunrise-Sunset Tables for your zone."],
  ["carcass-disposal", "LAWS_RULES", "Carcass Disposal (CWD)", "CR", 40,
    "To prevent the spread of chronic wasting disease, all parts of the head or skull containing brain material and/or the spinal columns of deer, elk, and moose harvested in Montana must be left in the field at the kill site, or if transported for further processing, disposed of in a Class II landfill once that processing is complete."],
  ["bonus-points", "LICENSING", "Bonus Point System", "MCA 87-2-117", 50,
    "Bonus points offer additional drawing chances for first-choice drawings only. Bonus points are mathematically **squared** prior to the drawing: with 3 existing bonus points you receive 3² = 9 chances plus your original application, for a total of 10 chances (3² + 1)."],
  ["restitution", "LAWS_RULES", "Restitution for Unlawfully Taken Wildlife", "MCA 87-6-906, CR", 60,
    "Under Montana law a person convicted of, or who has forfeited bond or bail for, unlawfully killing, taking, or possessing game animals shall reimburse the state. Restitution amounts for a trophy animal:\n\n| Species | Restitution |\n|---|---|\n| Bighorn Sheep | $30,000 |\n| Elk | $8,000 |\n| Antlered Deer | $8,000 |\n| Moose | $6,000 |\n| Mountain Goat | $6,000 |\n| Antelope | $2,000 |\n| Grizzly Bear* | $8,000 |\n\n*No authorized hunting season. The F&W Commission may adopt more specific trophy criteria (minimum antler/horn measurements for elk, mule deer, white-tailed deer, and antelope)."],
  ["check-stations", "LAWS_RULES", "Check Stations", "MCA 87-6-218", 70,
    "All hunters are required by law to stop as directed at all designated hunting check stations on their way to and from hunting areas, even if they have no game to be checked."],
  ["disturbing-traps", "LAWS_RULES", "Disturbing Traps or Trapped Animals", "MCA 87-6-601(5)", 80,
    "A person may not destroy, disturb, or remove any trap or snare belonging to another person, or remove wildlife from a trap or snare belonging to another, without permission of the owner of the trap or snare. Between March 1 and Oct 1 a person may remove a snare from land owned or leased by that person if the snare would endanger livestock; this does not apply to a law enforcement officer acting within the scope of duty."],
  ["dogs", "LAWS_RULES", "Dogs", "MCA 87-6-404", 90,
    "It is unlawful to use dogs to chase game animals. Exception: dogs may be used to hunt mountain lions and spring black bears (see appropriate regulations) and to recover or locate wounded game animals, but handlers must maintain physical control of the dog at all times by means of a maximum 50-foot lead attached to the dog's collar or harness."],
  ["evidence-of-sex-firearms", "LAWS_RULES", "Firearms", "CR", 100,
    "Firearms — including rifles, handguns, shotguns with 0, 00, or slugs, and muzzleloaders — and archery equipment are lawful for taking game animals; all other methods of take are prohibited. There is no rifle or handgun caliber limitation or magazine/round capacity restriction. Rifle scopes with illuminated reticles, built-in range finding, and \"red dot\" scopes are lawful. See specific muzzleloader requirements on the Weapons Restriction Areas page and the heritage muzzleloader season."],
  ["hunter-harassment", "LAWS_RULES", "Hunter Harassment", "MCA 87-6-215", 110,
    "It is unlawful to intentionally interfere with the lawful taking of a wild animal, or to disturb an individual engaged in the lawful taking of a wild animal with intent to prevent the taking."],
  ["incidental-harvest", "LAWS_RULES", "Incidental Harvest Resulting in an Unlawfully Taken Animal", "CR", 120,
    "If you or a member of your hunting party shoots an animal that results in an unlawfully taken animal, you should notify an FWP game warden or 1-800-TIP-MONT (1-800-847-6668) immediately and follow their instructions. **Hunters should field dress the animal but DO NOT transport the animal until you've received instructions.**"],
  ["indian-reservations", "LAWS_RULES", "Indian Reservations", "CR", 130,
    "The F&W Commission has by rule closed all lands within the exterior boundaries of Montana's Indian Reservations to the hunting of game animals with the use of state licenses unless provided for in a cooperative agreement between the Tribal Government and the State of Montana. Contact FWP for current agreements."],
  ["inspection-by-warden", "LAWS_RULES", "Inspection by Warden", "MCA 87-1-502, 87-6-218", 140,
    "Game animals, game birds, fish, and fur-bearers taken must be shown to FWP Enforcement personnel for inspection when requested."],
  ["iwvc", "LAWS_RULES", "Interstate Wildlife Violator Compact (IWVC)", "IWVC", 150,
    "Montana is a member of the IWVC. Under the compact, member states recognize suspensions of hunting, fishing, or trapping privileges. It is unlawful for a violator whose privilege to hunt, fish, or trap is suspended to obtain or attempt to obtain a license, tag, or permit in a member state. For more information, call 406-444-2452."],
  ["kill-site-verification", "LAWS_RULES", "Kill Site Verification", "ARM 12.6.1005", 160,
    "At the request of a Department Game Warden, it is required to return to the kill site of any game animal, game bird, wolf, or fur-bearer that has been hunted or trapped."],
  ["landowner-permission", "LAWS_RULES", "Landowner Permission", "MCA 87-6-415", 170,
    "A person may not hunt or attempt to hunt fur-bearers, game animals, migratory game birds, nongame wildlife, predatory animals, upland game birds, or wolves while hunting on private property without first obtaining permission of the landowner, lessee, or their agents. This applies regardless of whether the land is posted. For purposes of this section, \"hunt\" also includes entering private land to (a) retrieve wildlife; or (b) access public land to hunt."],
  ["license-possession", "LAWS_RULES", "License and Permit Possession/Use", "MCA 87-6-304, 87-6-305", 180,
    "A person may not apply for, purchase, or possess more than one license, permit, or tag of any one class or more than one special license for any one species. A person may not hunt unless carrying the required license or permit at the time, and must exhibit it and the identification used in purchasing it for inspection. A person may not alter, change, loan, or transfer any license to another person. The person to whom a license is issued shall validate it."],
  ["license-validation-tagging", "LAWS_RULES", "License Validation/Tagging", "MCA 87-6-411", 190,
    "When a person kills a game animal, before the carcass is removed from or the person leaves the site of the kill, take physical possession of the game animal by electronically validating the license or tag, or cutting out from the license or tag the date the animal was killed. A license or tag that is not electronically validated must accompany the carcass as long as any considerable portion remains unconsumed."],
  ["littering", "LAWS_RULES", "Littering", "MCA 75-10-212, 87-6-920", 200,
    "It is unlawful to dump or leave any garbage, dead animal, or other debris or refuse on any highway, road, street, or alley; on public property; within 200 yards of a public highway, road, street, or alley; or on privately owned property where hunting, fishing, or other recreation is permitted. A holder of a fishing, hunting, or camping license convicted of littering forfeits current licenses and the privilege to hunt, fish, camp, or trap for one year."],
  ["marked-radio-collared", "LAWS_RULES", "Marked or Radio-Collared Animals", "CR", 210,
    "It is lawful to shoot game animals that have radio collars, neck bands, ear tags, and/or other markers, but markers and radio collars must be returned to FWP. Please report the killing of a marked animal to the local FWP office."],
  ["masking-human-odor", "LAWS_RULES", "Masking Human Odor", "ARM 12.6.1016, MCA 87-6-101", 220,
    "Artificial scents and Responsible Hunting Scent Association (RHSA) approved natural glandular scents may be used by hunters for the purpose of masking human odor. Urine-based and natural glandular scents are approved by the F&W Commission if they originate from a state or province not listed as having documented occurrences of chronic wasting disease, or from an RHSA-certified facility that displays the required marks (RT-QuIC Tested / DPP)."],
  ["motion-tracking-devices", "LAWS_RULES", "Motion-Tracking Devices", "MCA 87-6-401", 230,
    "It is unlawful while hunting to use any electronic motion-tracking device or mechanism designed to track the motion of a game animal and relay information to the hunter (remote-operated cameras/video transmitting real-time information; seismic devices; thermal imaging; satellite and radio telemetry). A radio-tracking collar on a dog used by a hunter engaged in lawful hunting is not considered an unlawful motion-tracking device."],
  ["motorized-vehicles", "LAWS_RULES", "Motorized Vehicles", "MCA 87-6-405", 240,
    "It is unlawful to hunt or attempt to hunt any game animal from any self-propelled or drawn vehicle (to be lawful, a hunter must have both feet on the ground and his/her body outside the vehicle; the Permit To Hunt From A Vehicle is the exception); to use a motorized vehicle to concentrate, drive, rally, stir-up, corral, or harass game animals; or to use a motor-driven vehicle off-road on state land. On state trust lands, motorized travel is restricted to designated roads/trails."],
  ["off-highway-vehicles", "LAWS_RULES", "Off-Highway Vehicles (ATV, UTV, dirt bikes)", "MCA 23-2-804, 23-2-111", 250,
    "OHVs must be registered with the county treasurer and display a current off-highway permanent registration decal for off-road recreation on public lands. Resident hunters utilizing \"summer motorized recreation trails\" must purchase a summer motorized recreation trail pass ($20, valid two years). Nonresidents must obtain a nonresident temporary-use permit ($35, valid one calendar year)."],
  ["boats", "LAWS_RULES", "Boats", "MCA 87-6-207", 260,
    "A person may not use a motorboat or a sailboat for the purpose of killing, capturing, taking, pursuing, concentrating, driving, or stirring up any upland game bird, migratory bird, game animal, or fur-bearing animal until the motor is shut off and the progress of the vessel has ceased."],
  ["muzzleloader-heritage-weapons", "LAWS_RULES", "Muzzleloader Heritage Hunting Season Lawful Weapons", "MCA 87-1-304(9)", 270,
    "Plain lead projectiles and a muzzleloading rifle charged with loose black powder, loose pyrodex, or an equivalent loose black powder substitute, and ignited by a flintlock, wheel lock, matchlock, or percussion mechanism using a percussion or musket cap. The muzzleloading rifle must be a minimum of .45 caliber and may not have more than two barrels. The rifle may not use a cap/primer inserted into the open breech, be capable of being loaded from the breech, or be mounted with an optical magnification device."],
  ["outfitters-guides", "LAWS_RULES", "Outfitters and Guides", "MCA 37-47-301", 280,
    "A person may not act as an outfitter or guide, or advertise or represent to the public that the person is an outfitter or guide, without first securing a license. It is unlawful to engage in outfitting/guiding while not licensed, and unlawful to hire an outfitter or guide not licensed by the Department of Labor and Industry (call 406-841-2300)."],
  ["possession-wildlife-parts", "LAWS_RULES", "Possession of Wildlife Parts", "MCA 87-6-202", 290,
    "A person may not possess, ship, or transport all or part of any game fish, bird, game animal, or fur-bearing animal that was unlawfully killed, captured, or taken, whether killed, captured, or taken in Montana or outside Montana. \"Possess\" includes capturing, taking, or retaining physical possession. Certain naturally-shed antlers, hides/heads/mounts of lawfully-taken animals, and bones of naturally-died animals are exempted as described."],
  ["public-roadways", "LAWS_RULES", "Public Roadways", "MCA 87-6-403", 300,
    "It is unlawful for anyone to hunt or attempt to hunt any game animal on, from, or across any public highway or the shoulder, berm, barrow pit, or right-of-way of any public highway (the entire width between the boundary lines of every publicly maintained way when any part is open to the public for vehicular travel)."],
  ["predatory-nongame", "LAWS_RULES", "Predatory Animals and Nongame Hunting", "CR", 310,
    "Predatory animals and nongame species can be hunted in Montana year-round without a license by resident and nonresident hunters. A Conservation License, or a State School Trust lands recreational use license, is required to hunt predatory and nongame animals on State School Trust Lands, and landowner permission is required on private land. Predatory animals: coyote, weasel, (striped) skunk, and civet cat (spotted skunk). Nongame species include badger, raccoon, red fox, hares, rabbits, ground squirrels, marmots, tree squirrels, porcupines, and prairie dog."],
  ["recorded-animal-sounds", "LAWS_RULES", "Recorded Animal Sounds", "MCA 87-6-401", 320,
    "It is unlawful to use any recorded or electrically amplified bird or animal calls or sounds, or imitations of bird or animal calls or sounds, to assist in the hunting, taking, killing, or capturing of any wildlife except predatory animals, wolves, and those birds not protected by state or federal law."],
  ["sale-of-game", "LAWS_RULES", "Sale of Game Animals", "MCA 87-6-206", 330,
    "A person may not purposely or knowingly sell, purchase, or exchange all or part of any game fish, bird, game animal, or fur-bearing animal, except that a person may sell/purchase/exchange hides, heads, or mounts of lawfully taken animals, and naturally-shed antlers with a skull or portion attached from an animal that died from natural causes (mount or purchase of a grizzly bear hide/head/mount is prohibited except as provided by federal law). Sale of meat is not allowed."],
  ["simulated-wildlife", "LAWS_RULES", "Simulated Wildlife", "MCA 87-6-217", 340,
    "It is unlawful to discharge a firearm or other hunting implement at a simulated wildlife decoy in violation of any state statute, ARM, or F&W Commission rule regulating the hunting of the wildlife being simulated."],
  ["transport-of-wildlife", "LAWS_RULES", "Transport of Wildlife", "MCA 87-6-201", 350,
    "An individual other than the license holder may transport lawfully taken, properly tagged game animals that comply with the Evidence of Sex requirements. It is unlawful to ship, possess, transport, or take out of state unlawfully killed game animals."],
  ["traps", "LAWS_RULES", "Traps", "MCA 87-6-601", 360,
    "It is unlawful to destroy, disturb, or remove any trap or snare belonging to another person, or remove wildlife from a trap or snare belonging to another, without permission of the owner of the trap or snare."],
  ["two-way-communication", "LAWS_RULES", "Two-way Communication", "ARM 12.6.1010", 370,
    "The use of two-way electronic communication is prohibited while in the act of hunting game animals or wolves to aid in taking or locating live animals; while hunting mountain lion or bobcats with dogs beginning when the dogs are placed or physically released on tracks or a scent trail; to avoid game check stations or FWP enforcement personnel; or to facilitate unlawful hunting activity. Use for safety or other legitimate purposes is exempt. Includes radios, cell phones, text messages, and social media/apps."],
  ["vehicle-killed-salvage", "LAWS_RULES", "Vehicle Killed Wildlife Salvage Permit", "MCA 87-3-145, ARM 12.3.186", 380,
    "Carcasses and parts of elk, deer, antelope, and moose killed in vehicular collisions may be taken and possessed only with a Vehicle-Killed Wildlife Salvage Permit. No other game animals may be salvaged under this permit."],
  ["horns-skulls-mountain-sheep", "LAWS_RULES", "Recovery and Possession of Horns and Skulls from Mountain Sheep", "MCA 87-3-315", 390,
    "A person may recover and possess the horn(s) and attached skull, or portion thereof, of a mountain sheep that died of natural causes and was not purposefully or accidentally killed, captured, or taken. Horns and skulls recovered must be reported within 48 hours and presented to the department for inspection and placement of a permanent pin within 10 days ($25 pin fee). This does not allow recovery/possession found in state parks."],
  ["waste-of-game", "LAWS_RULES", "Waste of Game", "MCA 87-6-205", 400,
    "Hunters, or persons in possession of a game animal or game animal parts, are prohibited from wasting or rendering unfit for human consumption any part of a game animal defined as \"suitable for food.\" For game animals (excluding mountain lions), all four quarters including loin and backstrap are considered suitable for food."],
  ["weapons-restriction-areas", "LAWS_RULES", "Weapons Restriction Areas", "CR", 410,
    "Weapons restrictions are in effect in some hunting districts, stated in the license/permit description and/or with a specific date range. Equipment restrictions apply: **Archery** — see lawful archery equipment. **Crossbows** — lawful in weapons restriction areas unless an exception is noted. **Traditional Handguns** — not capable of being shoulder mounted, barrel length under 10½ inches, chamber only a straight wall cartridge. **Muzzleloader** — not capable of being loaded from the breech, no pre-prepared paper/metallic cartridges, charged with black powder/pyrodex, minimum .45 caliber, no more than two barrels. **Shotgun** — must be shouldered, breech- or muzzle-loaded, smooth bore and/or rifled barrel and/or rifled choke designed to fire shot or slugs."],
];

export async function loadFeesContent(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  const sd = await query<{ v: string }>(`SELECT source_doc_id::text AS v FROM regs.source_document WHERE season_year=$1 LIMIT 1`, [seasonYear]);
  const sourceDocId = sd.rows[0]?.v ?? null;

  await withTransaction("etl-fees-content", async (c) => {
    for (const [code, name, kind, species, sort, applyBy, chartNote, prices] of FEES) {
      const existing = await c.query<{ id: string }>(`SELECT product_id AS id FROM regs.license_product WHERE season_year=$1 AND product_code=$2`, [seasonYear, code]);
      let productId = existing.rows[0]?.id;
      if (!productId) {
        const r = await c.query<{ id: string }>(
          `INSERT INTO regs.license_product (season_year, product_code, display_name, product_kind, species_code, apply_by, chart_note, sort_order, updated_by, source_doc_id, source_page)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'etl',$9,12) RETURNING product_id AS id`,
          [seasonYear, code, name, kind, species, applyBy, chartNote, sort, sourceDocId]);
        productId = r.rows[0]!.id;
      } else {
        await c.query(
          `UPDATE regs.license_product SET display_name=$3, product_kind=$4, species_code=$5, apply_by=$6, chart_note=$7, sort_order=$8, updated_by='etl' WHERE season_year=$1 AND product_code=$2`,
          [seasonYear, code, name, kind, species, applyBy, chartNote, sort]);
      }
      await c.query(`DELETE FROM regs.product_price WHERE product_id=$1`, [productId]);
      for (const [aud, cents, note] of prices)
        await c.query(`INSERT INTO regs.product_price (product_id, audience_code, price_cents, price_note) VALUES ($1,$2,$3,$4)`,
          [productId, aud, cents, note ?? null]);
    }
    for (const [slug, cat, title, refs, sort, body] of CONTENT) {
      const existing = await c.query<{ id: string }>(`SELECT section_id AS id FROM regs.content_section WHERE season_year=$1 AND slug=$2`, [seasonYear, slug]);
      if (existing.rows[0]) {
        await c.query(`UPDATE regs.content_section SET category=$3, title=$4, body_md=$5, statute_refs=$6, sort_order=$7, updated_by='etl' WHERE season_year=$1 AND slug=$2`,
          [seasonYear, slug, cat, title, body, refs, sort]);
      } else {
        await c.query(`INSERT INTO regs.content_section (season_year, slug, category, title, body_md, statute_refs, sort_order, updated_by, source_doc_id, source_page)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,'etl',$8,20)`, [seasonYear, slug, cat, title, body, refs, sort, sourceDocId]);
      }
    }
  });
  const fp = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.license_product WHERE season_year=$1`, [seasonYear]);
  const cs = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.content_section WHERE season_year=$1`, [seasonYear]);
  console.log(`Fees/content seed for ${seasonYear}: ${fp.rows[0]!.n} products, ${cs.rows[0]!.n} content sections (DRAFT).`);
}

const isMain = process.argv[1]?.endsWith("loadFeesContent.ts") || process.argv[1]?.endsWith("loadFeesContent.js");
if (isMain) {
  loadFeesContent().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
