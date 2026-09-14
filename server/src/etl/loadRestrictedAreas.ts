/**
 * @file loadRestrictedAreas.ts
 * @module engage-mt/server/etl
 * @description Hand-curated seed of the "Restricted Area Descriptions" section
 *              (2026 DEA book pp.28-29) — the ~32 named Closed Areas, Weapons
 *              Restriction Areas, Archery-Only areas, and game preserves, plus the
 *              Libby CWD Management Zone. Transcribed faithfully from the printed
 *              book (the authoritative legal source); the full metes-and-bounds live
 *              in FWP's separate Legal Descriptions booklet, so `legal_desc` here
 *              carries the book's summary description. Idempotent per
 *              (season_year, area_name). Loads DRAFT.
 *              Usage: `tsx src/etl/loadRestrictedAreas.ts [year]` (default 2026).
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-04
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { withTransaction, closePool, query } from "../db/pool.js";

// area_name, area_type, legal_desc
type Area = [string, string, string];

const AREAS: Area[] = [
  ["Bad Rock Canyon WMA", "ARCHERY_ONLY",
    "Hunting by limited-access permit only. Archery and general season open Thursday through Sunday (or Monday if a holiday). Archery hunting open to archery equipment for all legal species, limited to two individuals/week awarded by lottery. General hunting and spring turkey seasons open to youth ages 10-15 and hunters with a PTHFV, limited to one party/day awarded by lottery. Closed to spring black bear hunting. Portions in T30N R20W."],
  ["BNSF Right-of-Way (Marias Pass to Java Creek Bridge)", "CLOSURE",
    "Closed to hunting."],
  ["Beattie Gulch", "CLOSURE",
    "Subject to closure of all hunting on 24 hours' notice: US Forest Service lands in the sections north of Yellowstone National Park in Beattie Gulch, Sec. 7 & 8, T9S R8E and Sections 12 & 13, T9S R7E."],
  ["Bitterroot-Clark Fork Archery District (Portion of HD 260)", "ARCHERY_ONLY",
    "Refer to legal description of deer/elk hunting district 260."],
  ["Bowdoin NWR", "CLOSURE",
    "Portions of T31N R31E, T31N R32E, T30N R31E, T30N R32E closed to big-game hunting as posted by refuge regulations. Contact refuge at 654-2863."],
  ["CMR National Wildlife Refuge — Slippery Ann Elk Viewing", "CLOSURE",
    "Closed to all hunting per refuge regulation 406-538-8706. Portions of Section 36, T22N R24E and Sections 31 and 32, T22N R25E."],
  ["Charles M. Russell NWR and U.S. Army Corps of Engineers", "RESTRICTED",
    "CMR NWR and U.S. Army Corps of Engineers (ACOE) regulations may differ from these regulations, to include closed or weapons-restricted areas. Contact the CMR at 406-538-8706 or the ACOE at 406-526-3411."],
  ["Cree Crossing WMA", "WEAPONS_RESTR",
    "Hunting by archery, shotgun, traditional handgun, or muzzleloader only. Portions of sections 11 and 12, T32N R32E as posted."],
  ["Deckard Flats to Trail Creek", "CLOSURE",
    "Subject to closure of elk hunting on 24 hours' notice: those portions of Park County lying within the described boundary near the confluence of the Yellowstone and Little Trail Creek northwest of Gardiner, easterly to the USFS Absaroka-Beartooth Wilderness Boundary."],
  ["East Ovando Archery Area", "ARCHERY_ONLY",
    "Restricted to ArchEquip only for all big-game hunting: portions of Powell County within the described boundary near the North Fork of the Blackfoot River, the Ovando-Helmville Road, State Route 200, and the North Fork of the Blackfoot River."],
  ["Ennis Airport Weapons Restriction Area", "WEAPONS_RESTR",
    "Ennis Airport WRA boundary: beginning at the intersection of Airport Rd and Hwy 287, along south boundary of section 32 to the USFS boundary, then north and west boundaries of sections 29 and 30, then south of section 30, then north of section 30, then south of section 30 to Hwy 287, then south along Hwy 287 to point of beginning."],
  ["Flathead Weapons Restriction Area and Blasdel WPAs", "WEAPONS_RESTR",
    "Restricted to ArchEquip, shotgun, traditional handgun, muzzleloader, or crossbow only: the portion of Flathead County within the described boundary near State Route 35, State Route 206, US Highway 2, US Highway 93, Rocky Cliff Drive, Foys Bend Lane, the Bonneville Power Administration powerline, and the Flathead River."],
  ["Freezout Lake WMA (Teton County)", "CLOSURE",
    "Closed to hunting as posted."],
  ["Gallatin Special Management Area", "RESTRICTED",
    "Closed to all deer and elk hunting except elk hunting by special permit: the Gallatin Special Management Area is a combination of the old Bacon Rind/Lodgepole and Buffalo Horn/Lodgepole units, in portions of Madison and Gallatin Counties within the described boundary. Hunters may use rifles on parcels of land 160 acres or larger that fall completely within the described boundary. See NOTE re: Sourdough Exclusion Zone from SWRA within HD 309."],
  ["Gallatin Valley Weapons Restriction Area", "WEAPONS_RESTR",
    "That portion of Gallatin County beginning at the intersection of Cottonwood Road and Enders Road, continuing southeast from that intersection along a lengthy described boundary through Bozeman-area roads to Bear Canyon Road, the Bear Canyon Interchange with Interstate 90, and back to the point of beginning."],
  ["Gardiner", "CLOSURE",
    "Closed to all hunting. Beginning at the junction of US Hwy 89 and Little Trail Creek, up Little Trail Creek to the posted line (approx 1/2 mile above US Hwy 89), then southeasterly along said line to the Travertine-Trail Creek Road, then to the YNP boundary, then westerly along said boundary to the junction with Stevens Creek/Yellowstone River, then along the Yellowstone River back to the point of beginning."],
  ["Gates of the Mountains Game Preserve", "CLOSURE",
    "Closed to all hunting. Beginning in Section 2, T12N R3W at the southeast corner of Upper Holter Lake, proceeding along the described boundary through the Gates of the Mountains area in Lewis and Clark County, to the Missouri River and back to Upper Holter Lake. Intending hereby to include all the territory adjacent to the Gates of the Mountains area, called and known as the Gates of the Mountains Game Preserve."],
  ["Grant Kohrs Ranch near Deer Lodge", "CLOSURE",
    "Closed to all hunting."],
  ["Helena Valley Regulating Reservoir", "CLOSURE",
    "The Bureau of Reclamation Regulating Reservoir in Sections 4, 5, 8, 9, 16, and 17, T10N R2W in Lewis and Clark County of the Helena Valley as posted. Open to hunting until the opening of the waterfowl season, then closed to all hunting."],
  ["Helena Valley Weapons Restriction Area", "WEAPONS_RESTR",
    "That portion of HD 388 west of the described boundary: from the intersection of US Highway 12-287 and Lake Helena Drive, north on said drive to the south shore of the Causeway Arm, then north and east on said shore to Hauser Lake."],
  ["Jeffers Weapons Restriction Area", "WEAPONS_RESTR",
    "Beginning at the intersection of Highway 287 and the south access to Jeffers Loop Road at milepost 47.1, then north along the access road until the junction with Jeffers Loop Road, then easterly along Jeffers Loop Road until its intersection with Jeffers Loop Road South, then northerly along Jeffers Loop Road until its intersection with Jeffers Road, then west along Jeffers Road to its intersection with the entrance to Valley Garden Fishing Access Site, then southwesterly along the west bank of the Madison River to its intersection with Highway 287, then southeast to point of beginning."],
  ["Lake Helena WMA", "CLOSURE",
    "Closed to all big-game hunting except as designated under hunting regulations. Portions of the north half of Section 22 T11N R3W."],
  ["Lee Metcalf Refuge", "CLOSURE",
    "Legal description, map and regulations available from the Lee Metcalf Refuge, 406-777-5552."],
  ["Libby Big Game Archery Only Hunting Area", "ARCHERY_ONLY",
    "That portion of Lincoln County within the described boundary: beginning at the junction of US Highway 2 and Port Blvd (the old Stimpson mill site entrance), the Champion Haul Road, National Forest Road #4813, National Forest Road #533, the Swede Mountain Road, the Farm-To-Market Road, US Highway 2, and back to Port Blvd."],
  ["Lincoln Closed Area", "CLOSURE",
    "Closed to all big-game hunting: Section 24, T14N R9W. This comprises the area around the town of Lincoln."],
  ["Medicine Lake National Wildlife Refuge", "CLOSURE",
    "Portions open to big-game hunting per refuge regulations. Contact refuge at 406-789-2305."],
  ["Milk River WMA Weapons Restriction Area", "WEAPONS_RESTR",
    "Hunting by archery, shotgun, traditional handgun, or muzzleloader only as posted and as described under current regulations."],
  ["Missouri River (Sand Coulee Creek to Great Falls City Limits)", "RESTRICTED",
    "Restricted to ArchEquip only: portion of HD 413 along the Missouri River between the mouth of Sand Coulee Creek downstream to the Great Falls city limits (includes Park and Taylor Islands and all other unnamed islands)."],
  ["Muskrat Valley Weapons Restriction Area", "WEAPONS_RESTR",
    "Restricted to archery, shotgun, traditional handgun, or muzzleloader only: that portion of Jefferson County within the described boundary near Boulder, Muskrat Lane, Upper Valley Road, Sloan Lane, the Interstate 15 frontage road, and Interstate 15."],
  ["Poindexter Slough FAS (south of Dillon)", "WEAPONS_RESTR",
    "Restricted to ArchEquip, shotgun, traditional handgun, muzzleloader, or crossbow only: Sections 26, 27, 34, and 35, T7S R9W."],
  ["Portion of the State Prison Ranch Property (west of Deer Lodge)", "CLOSURE",
    "Shall be closed as posted."],
  ["Prison Ranch Archery Only Area", "ARCHERY_ONLY",
    "Legal description and map available from FWP-R2 406-542-5500, in Missoula. The following MCE Ranch lands are open to hunting of big game only with Lawful Archery Equipment, as outlined in the hunting regulations, beginning at the junction of the Old Stage Road (county road) and Elk Ridge Road (Forest Service Road 5149) in Section 22, T8N R10W and along the described prison-fence-line boundary."],
  ["Rookery WMA Weapons Restriction Area", "WEAPONS_RESTR",
    "Hunting by archery, shotgun, traditional handgun, or muzzleloader only."],
  ["Seeley Lake Game Preserve", "CLOSURE",
    "Closed to all hunting: that portion of Missoula County within the described boundary near Boy Scout Road, Section 20, T17N R15W, the US Forest Service / private-land boundary, State Route 83, Riverview Drive, Snowmass Drive, and Clearwater River back to Boy Scout Road."],
  ["Silver Run WMA", "CLOSURE",
    "Closed to all hunting Dec 1-May 14."],
  ["Smith River WMA", "RESTRICTED",
    "Area map and rules available at FWP-R4 HQ 406-454-5840."],
  ["Smith Valley Weapons Restriction Area between Smith Lake Road and US Hwy 2", "WEAPONS_RESTR",
    "Restricted to ArchEquip, shotgun, traditional handgun, muzzleloader, or crossbow only: those portions of Flathead County within the described boundary near US Highway 2 West and Kila Road, Smith Lake Road, Whalebone Drive, and US Highway 2 back to Kila Road."],
  ["Sourdough Exclusion Zone from within HD 309", "RESTRICTED",
    "Beginning at the intersection of Nash and Sourdough Canyon Road, south on Sourdough Canyon Road to the USFS boundary, then east/north/east along said boundary in Section 8, to the State Lands intersection in Section 9, north along the section line of Sections 4 and 5, west along the section line of Sections 5 and 32 to Sourdough Road, south on Sourdough Road, then west on Nash Road, the point of beginning."],
  ["Sun River Game Preserve", "CLOSURE",
    "Closed to all hunting. Beginning at a point on the crest of the Continental Divide of the Rocky Mountains, south of the head or source of the South Fork of the Sun River, along the eastern boundary of the Sun River Game Preserve along the South and North Forks of the Sun River, to the crest of the Continental Divide and the place of beginning; including all territory between the South Fork of the Sun River and the North Fork of the Sun River on the east and the Continental Divide of the Rocky Mountains on the west."],
  ["Teton-Spring Creek Cooperative Hunting Area (TSCA)", "RESTRICTED",
    "Teton County; variety of weapons choices offered depending on proximity to residences. Area map/rules available FWP-R4 406-454-5840, Great Falls. All in T24N R5W, legally described as Sections 2, 3, 4, 9, 10, 11, 14, 15, and W1/2 of Section 13."],
  ["Townsend Weapons Restriction Area", "WEAPONS_RESTR",
    "Beginning at the intersection of US Highway 12 and Route 284, northerly along said route to Riley Road, west along said road to the Canyon Ferry Wildlife Management Area boundary fence as signed, then northerly/westerly along said boundary fence and the described roads (Hahn Road, US Highway 287, Kimber Gulch Road, Springville Lane, Indian Creek Road, Deep Creek Road, Jack Farm Road, Cemetery Road, US Highway 12, Route 284) back to the point of beginning. Portions of sections 17,18,20 T32N R33E as posted."],
  ["UL Bend National Wildlife Refuge", "RESTRICTED",
    "UL Bend National Wildlife Refuges and U.S. Army Corps of Engineers (ACOE) regulations may differ from these regulations, to include closed or weapons-restricted areas. Contact the CMR at 406-538-8706 or the ACOE at 406-526-3411."],
  ["Wall Creek WMA and adjacent land as posted", "CLOSURE",
    "Beginning at the junction of Ruby Creek and the Madison River, southerly along the east bank of said river to Wall Creek, westerly along Wall Creek to the USFS boundary, then along the described boundary (USFS Road 933, the USFS/Wall Creek WMA boundary, Ruby Creek) back to the Madison River, the point of beginning."],
  ["Warm Springs WMA", "WEAPONS_RESTR",
    "Restricted district within the Warm Springs WMA restricted to ArchEquip, shotgun, traditional handgun, muzzleloader, or crossbow only."],
  ["Yellowstone River Islands", "RESTRICTED",
    "Portion of the Yellowstone River islands between the East Park Street Bridge at Livingston and one mile downstream of the US Highway 89 Bridge restricted to ArchEquip only."],
  ["Libby CWD Management Zone", "MGMT_ZONE",
    "The Libby CWD Management Zone (referenced by Deer B license 199-20) delineates the area around Libby in which chronic-wasting-disease management regulations apply. See the current CWD management regulations and Deer B 199-20 for the specific boundary and carcass-transport rules."],
];

// District ↔ restricted-area links. Keyed on restricted_area.area_name; each value is the set
// of HD codes whose per-district NOTE names that area. Derived from the 2026 book's deer/elk
// district NOTEs (the "Check Restricted Area Legal Description (p 28-30) …" references + WMA
// closure callouts) via a note-scan of the staged data; the six areas whose district NOTE the
// Phase-A extraction did not capture (Helena Valley pair, Jeffers, Lake Helena, Sun River Game
// Preserve, TSCA) are supplemented from the printed section + district maps.
const DISTRICT_LINKS: Record<string, string[]> = {
  "Bad Rock Canyon WMA": ["170"],
  "BNSF Right-of-Way (Marias Pass to Java Creek Bridge)": ["141"],
  "Beattie Gulch": ["313", "314"],
  "Bitterroot-Clark Fork Archery District (Portion of HD 260)": ["260"],
  "Bowdoin NWR": ["620"],
  "CMR National Wildlife Refuge — Slippery Ann Elk Viewing": ["620", "621"],
  "Charles M. Russell NWR and U.S. Army Corps of Engineers": ["410", "417", "621", "622", "630", "650", "652", "700"],
  "Cree Crossing WMA": ["670"],
  "Deckard Flats to Trail Creek": ["313"],
  "East Ovando Archery Area": ["290"],
  "Ennis Airport Weapons Restriction Area": ["360"],
  "Flathead Weapons Restriction Area and Blasdel WPAs": ["170"],
  "Freezout Lake WMA (Teton County)": ["444"],
  "Gallatin Special Management Area": ["310"],
  "Gallatin Valley Weapons Restriction Area": ["311"],
  "Gardiner": ["313"],
  "Gates of the Mountains Game Preserve": ["339", "392", "455"],
  "Grant Kohrs Ranch near Deer Lodge": ["213"],
  "Helena Valley Regulating Reservoir": ["388"],
  "Helena Valley Weapons Restriction Area": ["388"],
  "Jeffers Weapons Restriction Area": ["360"],
  "Lake Helena WMA": ["388"],
  "Lee Metcalf Refuge": ["260"],
  "Libby Big Game Archery Only Hunting Area": ["103"],
  "Lincoln Closed Area": ["284"],
  "Medicine Lake National Wildlife Refuge": ["640"],
  "Milk River WMA Weapons Restriction Area": ["670"],
  "Missouri River (Sand Coulee Creek to Great Falls City Limits)": ["413"],
  "Muskrat Valley Weapons Restriction Area": ["380"],
  "Poindexter Slough FAS (south of Dillon)": ["310", "331"],
  "Portion of the State Prison Ranch Property (west of Deer Lodge)": ["213"],
  "Prison Ranch Archery Only Area": ["213"],
  "Rookery WMA Weapons Restriction Area": ["600"],
  "Seeley Lake Game Preserve": ["285"],
  "Silver Run WMA": ["525"],
  "Smith River WMA": ["416", "446"],
  "Smith Valley Weapons Restriction Area between Smith Lake Road and US Hwy 2": ["120"],
  "Sourdough Exclusion Zone from within HD 309": ["309"],
  "Sun River Game Preserve": ["422", "424", "442"],
  "Teton-Spring Creek Cooperative Hunting Area (TSCA)": ["444"],
  "Townsend Weapons Restriction Area": ["380", "390", "391"],
  "UL Bend National Wildlife Refuge": ["622"],
  "Wall Creek WMA and adjacent land as posted": ["323"],
  "Warm Springs WMA": ["215"],
  "Yellowstone River Islands": ["315", "317", "393"],
  "Libby CWD Management Zone": ["100", "103", "104", "121", "123", "124", "130"],
};

export async function loadRestrictedAreas(seasonYear = Number(process.argv[2]) || 2026): Promise<void> {
  const sd = await query<{ v: string }>(`SELECT source_doc_id::text AS v FROM regs.source_document WHERE season_year=$1 LIMIT 1`, [seasonYear]);
  const sourceDocId = sd.rows[0]?.v ?? null;

  let links = 0;
  let unlinked = 0;
  await withTransaction("etl-restricted-areas", async (c) => {
    const rareaId = new Map<string, string>();
    for (const [name, type, desc] of AREAS) {
      const existing = await c.query<{ id: string }>(
        `SELECT rarea_id AS id FROM regs.restricted_area WHERE season_year=$1 AND area_name=$2`, [seasonYear, name]);
      let id: string;
      if (existing.rows[0]) {
        id = existing.rows[0].id;
        await c.query(
          `UPDATE regs.restricted_area SET area_type=$3, legal_desc=$4, updated_by='etl' WHERE season_year=$1 AND area_name=$2`,
          [seasonYear, name, type, desc]);
      } else {
        id = (await c.query<{ id: string }>(
          `INSERT INTO regs.restricted_area (season_year, area_type, area_name, legal_desc, updated_by, source_doc_id, source_page)
           VALUES ($1,$2,$3,$4,'etl',$5,28) RETURNING rarea_id AS id`, [seasonYear, type, name, desc, sourceDocId])).rows[0]!.id;
      }
      rareaId.set(name, id);
    }

    // Rebuild district_rarea links idempotently for this season's areas.
    await c.query(
      `DELETE FROM regs.district_rarea dr USING regs.restricted_area ra
        WHERE dr.rarea_id=ra.rarea_id AND ra.season_year=$1`, [seasonYear]);
    for (const [name, hdCodes] of Object.entries(DISTRICT_LINKS)) {
      const rid = rareaId.get(name);
      if (!rid) continue;
      for (const hd of hdCodes) {
        const d = await c.query<{ id: string }>(
          `SELECT district_id AS id FROM regs.district WHERE geography_code='HD' AND district_code=$1`, [hd]);
        if (!d.rows[0]) { unlinked++; continue; }
        await c.query(
          `INSERT INTO regs.district_rarea (district_id, rarea_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [d.rows[0].id, rid]);
        links++;
      }
    }
  });
  const n = await query<{ n: string }>(`SELECT count(*) AS n FROM regs.restricted_area WHERE season_year=$1`, [seasonYear]);
  console.log(`Restricted areas for ${seasonYear}: ${n.rows[0]!.n} areas, ${links} district links (${unlinked} unresolved HD codes) (DRAFT).`);
}

const isMain = process.argv[1]?.endsWith("loadRestrictedAreas.ts") || process.argv[1]?.endsWith("loadRestrictedAreas.js");
if (isMain) {
  loadRestrictedAreas().then(() => closePool()).then(() => process.exit(0)).catch((e) => { console.error(e); void closePool().finally(() => process.exit(1)); });
}
