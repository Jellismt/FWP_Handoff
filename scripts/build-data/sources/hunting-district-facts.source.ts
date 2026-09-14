/**
 * @file hunting-district-facts.source.ts
 * @module engage-mt/scripts/build-data/sources
 * @description Hunting-district facts for the 139 Montana big-game (deer/elk/
 *              lion) hunting districts.
 *
 *              AUTHORITATIVE fields:
 *                • district set — FWP-GIS admbnd/huntingDistricts/MapServer/11
 *                  (139 records, REGYEAR 2026)
 *                • name        — FWP per-district hunting guide
 *                  (myfwp.mt.gov/fwpPub/speciesLegalDiv.action), e.g. HD 380 =
 *                  "Radersburg" (the Elkhorn Mountains district)
 *                • region      — FWP-GIS REG field
 *                • acres       — FWP-GIS AREA_AC field (per-district override)
 *                • counties    — parsed from the FWP per-district legal
 *                  description (speciesLegalDiv.action)
 *                • weapon_restriction — `true` for the 12 districts whose FWP
 *                  legal description names a weapon-restriction area (3.1).
 *
 *              Only facts with an authoritative per-district source are
 *              carried: name, acreage, counties, region, and the
 *              weapon-restriction flag. Season windows, weapons, hunting
 *              status, and primary species are not synthesized here; the
 *              per-species regulations come live from the FWP Regs Manager
 *              API (useDistrictRegulations).
 *
 *              No `public_share_pct` / `top_access` fields: no authoritative per-district
 *              source exists for them, so they are not synthesized.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-09-06
 * @version 3.2.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

export interface DistrictFactsRow {
  district: string;
  region: number;
  name: string;
  acres: number;
  /** Counties the district spans — parsed from the FWP per-district legal
   *  description (authoritative). Comma-joined, in legal-text order.
   *  Empty string when FWP publishes no legal boundary (e.g. HD 432). */
  counties: string;
  /** AUTHORITATIVE — `true` for the districts whose FWP per-district legal
   *  description names a weapon-restriction area (archery-only / shotgun- or
   *  muzzleloader-only zones, typically near developed areas). Replaces the
   *  free-text `weapon` string dropped in 3.0 — the general-season weapon
   *  windows themselves now come live from the Regs Manager, but the
   *  district-level restriction-area designation is not in that API. */
  weapon_restriction: boolean;
}

// District→region map for all 175 Montana hunting districts. Region prefix:
//   100s → R1 NW, 200s → R2 WC, 300s → R3 SW, 400s → R4 Central,
//   500s → R5 South-central, 600s → R6 Northeast, 700s → R7 Southeast.
const REGION_OF = (district: string): number => {
  const code = parseInt(district, 10);
  if (code >= 100 && code < 200) return 1;
  if (code >= 200 && code < 300) return 2;
  if (code >= 300 && code < 400) return 3;
  if (code >= 400 && code < 500) return 4;
  if (code >= 500 && code < 600) return 5;
  if (code >= 600 && code < 700) return 6;
  return 7;
};

// Assembles a district row from its authoritative override (acres, name,
// counties, weapon-restriction flag).
const factsFor = (district: string, name: string, override?: Partial<DistrictFactsRow>): DistrictFactsRow => {
  const region = REGION_OF(district);
  // Acres come from the FWP-GIS AREA_AC field via the per-district override;
  // this fallback only fires for a code with no override (none today).
  const acres = override?.acres ?? 0;
  return {
    district,
    region,
    name,
    acres,
    counties: "",
    // Default: no weapon-restriction area. The 12 districts whose FWP legal
    // description names one carry `weapon_restriction: true` in their override.
    weapon_restriction: false,
    ...override,
  };
};

// Canonical district list — the 139 big-game districts from FWP-GIS, with
// FWP's own published district names + authoritative acreage. Generated, not
// hand-typed: provenance is the FWP-GIS service plus the per-district legal descriptions.
// HD 432 carries no FWP-published name → number-only fallback.
const DISTRICTS: Array<{ code: string; name: string; override?: Partial<DistrictFactsRow> }> = [
  // Region 1
  { code: "100", name: "North Kootenai", override: { acres: 900_622, counties: "Lincoln" } },
  { code: "101", name: "Eureka", override: { acres: 515_732, counties: "Lincoln, Flathead" } },
  { code: "103", name: "South Salish", override: { acres: 927_024, counties: "Lincoln, Flathead", weapon_restriction: true } },
  { code: "104", name: "Cabinets", override: { acres: 483_714, counties: "Lincoln" } },
  { code: "110", name: "North Fork", override: { acres: 507_772, counties: "Flathead, Lincoln" } },
  { code: "120", name: "Blacktail", override: { acres: 315_450, counties: "Flathead, Lincoln", weapon_restriction: true } },
  { code: "121", name: "West Clark Fork", override: { acres: 627_168, counties: "Sanders" } },
  { code: "122", name: "Thompson River", override: { acres: 458_508, counties: "Flathead, Sanders, Lincoln" } },
  { code: "123", name: "Clark Mountain", override: { acres: 152_606, counties: "Sanders" } },
  { code: "124", name: "Arvilla", override: { acres: 82_508, counties: "Sanders" } },
  { code: "130", name: "Swan", override: { acres: 430_174, counties: "Lake, Missoula" } },
  { code: "140", name: "Lower South Fork", override: { acres: 561_813, counties: "Flathead" } },
  { code: "141", name: "Lower Middle Fork", override: { acres: 216_894, counties: "Flathead" } },
  { code: "150", name: "Upper South Fork", override: { acres: 747_939, counties: "Flathead, Missoula, Powell" } },
  { code: "170", name: "Flathead River", override: { acres: 231_608, counties: "Flathead", weapon_restriction: true } },
  // Region 2
  { code: "200", name: "North St. Regis", override: { acres: 152_000, counties: "Mineral, Sanders" } },
  { code: "201", name: "Missoula - Ninemile - North Superior", override: { acres: 668_845, counties: "Missoula, Mineral, Sanders" } },
  { code: "202", name: "South Superior", override: { acres: 614_049, counties: "Missoula, Mineral" } },
  { code: "204", name: "North Sapphire", override: { acres: 257_923, counties: "Ravalli, Granite, Missoula" } },
  { code: "210", name: "John Long Range", override: { acres: 312_492, counties: "Missoula, Granite" } },
  { code: "211", name: "Upper Rock Creek-Georgetown Lake", override: { acres: 260_612, counties: "Lake, Granite" } },
  { code: "212", name: "West Flint Range", override: { acres: 85_155, counties: "Granite", weapon_restriction: true } },
  { code: "213", name: "East Flint Range", override: { acres: 317_147, counties: "Granite, Powell, Deer Lodge", weapon_restriction: true } },
  { code: "214", name: "Mill Creek-Storm Lake", override: { acres: 74_280, counties: "Lake, Deer Lodge" } },
  { code: "215", name: "East Deer Lodge", override: { acres: 370_345, counties: "Deer Lodge, Silver Bow, Powell" } },
  { code: "216", name: "West Rock Creek-Quigg Peak", override: { acres: 189_603, counties: "Granite, Missoula" } },
  { code: "217", name: "Northwest Flint Range", override: { acres: 91_173, counties: "Granite, Powell" } },
  { code: "240", name: "West Bitterroot", override: { acres: 429_757, counties: "Missoula, Ravalli" } },
  { code: "250", name: "West Fork Bitterroot", override: { acres: 355_100, counties: "Ravalli" } },
  { code: "260", name: "Bitterroot-Clark Fork Archery District", override: { acres: 98_901, counties: "Missoula, Ravalli" } },
  { code: "261", name: "East Bitterroot", override: { acres: 137_273, counties: "Ravalli" } },
  { code: "262", name: "Bitterroot Farmlands", override: { acres: 79_845, counties: "Missoula, Ravalli" } },
  { code: "270", name: "East Fork Bitterroot", override: { acres: 424_844, counties: "Ravalli" } },
  { code: "280", name: "North Blackfoot", override: { acres: 194_951, counties: "Powell, Lewis and Clark" } },
  { code: "281", name: "Upper Blackfoot", override: { acres: 242_333, counties: "Powell, Lewis and Clark", weapon_restriction: true } },
  { code: "282", name: "Blackfoot-Clearwater WMA", override: { acres: 26_136, counties: "Missoula, Powell" } },
  { code: "284", name: "Lincoln Archery District", override: { acres: 10_901, counties: "Lincoln, Lewis and Clark" } },
  { code: "285", name: "Monture", override: { acres: 423_419, counties: "Missoula, Powell" } },
  { code: "290", name: "Helmville-Ovando Archery District", override: { acres: 33_726, counties: "Powell" } },
  { code: "291", name: "East Garnet Range", override: { acres: 205_834, counties: "Powell" } },
  { code: "292", name: "West Garnet Range", override: { acres: 309_755, counties: "Missoula, Granite, Powell" } },
  { code: "293", name: "South Lincoln-Nevada Creek", override: { acres: 284_423, counties: "Lincoln, Powell, Lewis and Clark" } },
  { code: "298", name: "Ovando-Helmville", override: { acres: 96_987, counties: "Powell" } },
  // Region 3
  { code: "301", name: "Hyalite-Portal", override: { acres: 210_216 } },
  { code: "302", name: "Tendoys", override: { acres: 383_510, counties: "Beaverhead" } },
  { code: "303", name: "Lima Peaks-Nicholia", override: { acres: 208_966, counties: "Beaverhead" } },
  { code: "304", name: "Spanish Peaks", override: { acres: 280_740, counties: "Madison, Gallatin" } },
  { code: "309", name: "Gallatin Valley Weapons Restriction Area", override: { acres: 110_484, counties: "Gallatin, Valley", weapon_restriction: true } },
  { code: "310", name: "Upper Gallatin", override: { acres: 200_780, counties: "Gallatin, Madison" } },
  { code: "311", name: "Lower Madison", override: { acres: 361_847, counties: "Madison, Gallatin, Jefferson, Broadwater" } },
  { code: "312", name: "West Bridger", override: { acres: 316_815, counties: "Gallatin" } },
  { code: "313", name: "Gardiner", override: { acres: 124_625, counties: "Park" } },
  { code: "314", name: "Upper Yellowstone West", override: { acres: 346_731, counties: "Yellowstone, Gallatin, Park" } },
  { code: "315", name: "West Slope Crazy Mountains", override: { acres: 371_145, counties: "Meagher, Park, Sweet Grass" } },
  { code: "316", name: "Absaroka", override: { acres: 298_510, counties: "Carbon, Sweet Grass, Park" } },
  { code: "317", name: "Upper Yellowstone East", override: { acres: 271_101, counties: "Yellowstone, Park" } },
  { code: "318", name: "Butte-Basin", override: { acres: 172_815, counties: "Jefferson" } },
  { code: "319", name: "Fleecer-High Rye", override: { acres: 396_943, counties: "Silver Bow, Deer Lodge" } },
  { code: "320", name: "Tobacco Root Mountains", override: { acres: 513_842, counties: "Madison, Jefferson" } },
  { code: "321", name: "West Big Hole-Mussigbrod", override: { acres: 503_557, counties: "Beaverhead" } },
  { code: "322", name: "HD 322", override: { acres: 291_680, counties: "Stillwater, Park" } }, // FWP publishes no district name
  { code: "323", name: "Gravelly-Centennial", override: { acres: 1_322_016, counties: "Madison, Beaverhead" } },
  { code: "324", name: "Blacktail Mountains", override: { acres: 331_149, counties: "Beaverhead" } },
  { code: "329", name: "Big Hole Divide - Horse Prairie", override: { acres: 505_668, counties: "Prairie, Beaverhead" } },
  { code: "331", name: "Pioneer Mountains-East Big Hole", override: { acres: 871_114, counties: "Beaverhead, Deer Lodge, Madison" } },
  { code: "335", name: "Helena-South", override: { acres: 139_142, counties: "Lewis and Clark, Jefferson" } },
  { code: "339", name: "Sieben-Sleeping Giant", override: { acres: 188_147, counties: "Lewis and Clark" } },
  { code: "340", name: "Highlands", override: { acres: 544_659, counties: "Beaverhead, Madison, Jefferson, Silver Bow" } },
  { code: "343", name: "Helena-North", override: { acres: 157_138, counties: "Lewis and Clark" } },
  { code: "350", name: "Whitetail-Bull Mountains", override: { acres: 228_206, counties: "Silver Bow, Jefferson" } },
  { code: "360", name: "Madison Range", override: { acres: 434_100, counties: "Madison, Gallatin", weapon_restriction: true } },
  { code: "361", name: "Hebgen-Upper Madison", override: { acres: 143_660, counties: "Madison, Gallatin" } },
  { code: "370", name: "Bull Mountains", override: { acres: 118_440, counties: "Jefferson" } },
  { code: "380", name: "Radersburg", override: { acres: 668_199, counties: "Jefferson, Broadwater, Lewis and Clark", weapon_restriction: true } },
  { code: "388", name: "Tenmile - Prickly Pear Valley", override: { acres: 125_263, counties: "Valley, Lewis and Clark, Jefferson", weapon_restriction: true } },
  { code: "390", name: "Sixteenmile Creek", override: { acres: 217_786, counties: "Broadwater, Gallatin, Meagher" } },
  { code: "391", name: "Dry Creek-Avalanche", override: { acres: 302_372, counties: "Broadwater, Lewis and Clark", weapon_restriction: true } },
  { code: "392", name: "Avalanche-Gates of the Mountains", override: { acres: 160_457, counties: "Broadwater, Lewis and Clark" } },
  { code: "393", name: "East Bridger", override: { acres: 395_126, counties: "Park, Gallatin, Meagher" } },
  // Region 4
  { code: "400", name: "Lower Marias River", override: { acres: 1_210_034, counties: "Toole, Pondera, Liberty, Chouteau" } },
  { code: "401", name: "Sweet Grass Hills", override: { acres: 1_158_706, counties: "Sweet Grass, Toole, Liberty" } },
  { code: "403", name: "Cut Bank", override: { acres: 422_850, counties: "Glacier, Toole" } },
  { code: "404", name: "Lower Teton River", override: { acres: 1_244_220, counties: "Teton, Pondera, Chouteau, Cascade" } },
  { code: "405", name: "Carter", override: { acres: 301_315, counties: "Carter, Cascade, Chouteau" } },
  { code: "406", name: "Upper Marias-Dupuyer", override: { acres: 452_168, counties: "Glacier, Toole, Pondera, Teton" } },
  { code: "410", name: "Missouri River Breaks", override: { acres: 1_018_915, counties: "Fergus, Petroleum, Garfield" } },
  { code: "411", name: "Snowy Mountains", override: { acres: 754_384, counties: "Golden Valley, Valley, Fergus, Judith Basin" } },
  { code: "412", name: "Judith and Moccasin Mountains", override: { acres: 422_638, counties: "Fergus" } },
  { code: "413", name: "Northwest Little Belt Mountains", override: { acres: 562_362, counties: "Cascade, Meagher" } },
  { code: "415", name: "Summit-North Fork Birch Creek", override: { acres: 132_176, counties: "Pondera, Glacier" } },
  { code: "416", name: "Southwest Little Belt Mountains", override: { acres: 418_364, counties: "Cascade, Meagher, Judith Basin" } },
  { code: "417", name: "Armells Creek", override: { acres: 550_278, counties: "Fergus" } },
  { code: "418", name: "South Judith Basin", override: { acres: 307_293, counties: "Judith Basin, Fergus" } },
  { code: "419", name: "Stanford", override: { acres: 438_660, counties: "Judith Basin, Fergus" } },
  { code: "420", name: "Judith River WMA-Sage Creek", override: { acres: 49_506, counties: "Judith Basin" } },
  { code: "421", name: "Birdtail Hills - South Dearborn", override: { acres: 518_688, counties: "Cascade, Lewis and Clark" } },
  { code: "422", name: "North Dearborn", override: { acres: 310_176, counties: "Lewis and Clark" } },
  { code: "424", name: "Benchmark", override: { acres: 60_705, counties: "Lewis and Clark" } },
  { code: "425", name: "Sun River WMA", override: { acres: 91_417, counties: "Lewis and Clark" } },
  { code: "426", name: "Winifred", override: { acres: 540_768, counties: "Fergus, Judith Basin" } },
  { code: "432", name: "HD 432", override: { acres: 314_618 } }, // FWP publishes no district name
  { code: "441", name: "North Fork Birch Creek-Teton", override: { acres: 380_987, counties: "Teton, Pondera" } },
  { code: "442", name: "Sun River", override: { acres: 190_644, counties: "Lewis and Clark, Teton" } },
  { code: "444", name: "Lower Sun River", override: { acres: 310_559, counties: "Cascade, Lewis and Clark, Teton" } },
  { code: "445", name: "Hound Creek", override: { acres: 445_079, counties: "Cascade, Lewis and Clark, Meagher" } },
  { code: "446", name: "Northeast Big Belt Mountains", override: { acres: 379_826, counties: "Meagher, Lewis and Clark" } },
  { code: "447", name: "Belt-Square Butte", override: { acres: 565_507, counties: "Cascade, Chouteau, Judith Basin" } },
  { code: "448", name: "North Judith Basin-Central Little Belts", override: { acres: 245_580, counties: "Judith Basin, Cascade, Meagher" } },
  { code: "450", name: "Choteau", override: { acres: 260_385, counties: "Teton" } },
  { code: "451", name: "Southeast Big Belt Mountains", override: { acres: 90_779, counties: "Meagher" } },
  { code: "452", name: "Castle Mountains", override: { acres: 216_489, counties: "Meagher" } },
  { code: "455", name: "Beartooth WMA", override: { acres: 41_954, counties: "Cascade, Lewis and Clark" } },
  { code: "471", name: "Geraldine", override: { acres: 481_219, counties: "Chouteau, Fergus" } },
  // Region 5
  { code: "502", name: "Crow Line", override: { acres: 469_333, counties: "Carbon, Yellowstone" } },
  { code: "515", name: "Painted Robe", override: { acres: 1_613_625, counties: "Golden Valley, Valley, Stillwater, Sweet Grass, Wheatland, Yellowstone" } },
  { code: "525", name: "Beartooth - Absaroka", override: { acres: 1_043_903, counties: "Carbon, Stillwater, Sweet Grass, Park" } },
  { code: "535", name: "Southern Snowy Mountains", override: { acres: 1_769_586, counties: "Wheatland, Fergus, Golden Valley, Valley, Musselshell, Petroleum" } },
  { code: "540", name: "Southeast Little Belt Mountains", override: { acres: 373_219, counties: "Meagher, Wheatland" } },
  { code: "555", name: "Pryor Mountains - Cottonwood Triangle", override: { acres: 505_811, counties: "Carbon" } },
  { code: "565", name: "Upper Boulder", override: { acres: 131_020, counties: "Park, Sweet Grass" } },
  { code: "575", name: "Absarokee", override: { acres: 524_158, counties: "Carbon, Stillwater, Sweet Grass, Yellowstone" } },
  { code: "580", name: "East Slope Crazy Mountains", override: { acres: 721_468, counties: "Meagher, Park, Sweet Grass, Wheatland" } },
  { code: "590", name: "Bull Mountains-Pine Ridge", override: { acres: 1_866_620, counties: "Big Horn, Golden Valley, Valley, Musselshell, Yellowstone" } },
  // Region 6
  { code: "600", name: "North Hill-Blaine", override: { acres: 1_959_118, counties: "Hill, Blaine", weapon_restriction: true } },
  { code: "620", name: "South Phillips", override: { acres: 1_120_612, counties: "Phillips, Valley" } },
  { code: "621", name: "Upper Missouri Breaks-West", override: { acres: 515_523, counties: "Blaine, Phillips" } },
  { code: "622", name: "Middle Missouri Breaks", override: { acres: 460_540 } },
  { code: "630", name: "South Valley", override: { acres: 985_082, counties: "Valley, Phillips" } },
  { code: "640", name: "Northeast Montana", override: { acres: 2_391_817, counties: "Daniels, Sheridan, Roosevelt, Valley" } },
  { code: "650", name: "McCone-Richland", override: { acres: 2_259_946, counties: "McCone, Richland, Dawson" } },
  { code: "652", name: "McCone-Garfield", override: { acres: 184_170, counties: "McCone, Garfield" } },
  { code: "670", name: "North Phillips-Valley", override: { acres: 2_638_440, counties: "Phillips, Valley, Blaine" } },
  { code: "690", name: "South Hill-Blaine-Chouteau", override: { acres: 2_557_112, counties: "Hill, Blaine, Chouteau" } },
  // Region 7
  { code: "700", name: "Missouri Breaks-Prairie", override: { acres: 1_784_261, counties: "Prairie, Garfield, Petroleum, McCone" } },
  { code: "701", name: "Sagebrush Prairie", override: { acres: 4_619_740, counties: "Prairie, Custer, Rosebud, Treasure, Yellowstone, Musselshell, Garfield, McCone" } },
  { code: "702", name: "Yellowstone Pine Hills", override: { acres: 1_766_800, counties: "Yellowstone, Treasure, Big Horn, Rosebud, Custer" } },
  { code: "703", name: "Grassland-Agriculture", override: { acres: 3_493_293, counties: "Prairie, McCone, Dawson, Richland, Wibaux, Fallon, Custer" } },
  { code: "704", name: "Powder Pine Hills", override: { acres: 3_474_786, counties: "Big Horn, Custer, Fallon, Powder River, Prairie, Rosebud" } },
  { code: "705", name: "HD 705", override: { acres: 3_947_231, counties: "Prairie, Carter, Custer, Powder River, Fallon" } }, // FWP publishes no district name
];

export const rows: DistrictFactsRow[] = DISTRICTS.map(({ code, name, override }) =>
  factsFor(code, name, override),
);
