# SmartMediBox — materials list and case image prompts

Status: planning draft, 18 November 2026. Nothing here has been bench-tested.
It matches the existing single-bin circuit in `hardware/smartbox-wokwi-v2/`
(ESP32-S3, HX711 + load cell, ILI9341 TFT, LED, passive buzzer, silence button).
Check every part against its own datasheet before powering it. Image prompts
produce concept illustrations only — they are not dimensioned CAD and must not
be used for fabrication.

---

## 1. Electronics (core — needed to build the existing circuit)

| # | Part | Recommended choice | Qty | Why / notes |
|---|------|-------------------|-----|-------------|
| 1 | Microcontroller | ESP32-S3-DevKitC-1, **N16R8** or N8R8 (USB-C) | 1 (+1 spare) | Same board as the simulation. On R8 (octal PSRAM) boards GPIO 35–37 are reserved; current pins (10–14, 16, 17, 21, 38–40) avoid them. |
| 2 | Load cell | **Mini bar (straight) load cell, 500 g** (TAL221-style, 4-wire) | 1 | The simulation used 5 kg — far too coarse for pills. 500 g leaves room for the cup and lid-free platform. Optionally also buy a **100 g** cell to compare resolution. |
| 3 | Load-cell amplifier | HX711 breakout with **selectable rate (RATE pin → 10 SPS)**, e.g. SparkFun-style green board | 1 (+1 spare) | 10 samples/s is quieter than 80. Power it from **3.3 V** so DT/SCK are safe for the ESP32-S3. |
| 4 | Display | **2.8" ILI9341 SPI TFT, 240×320**, 3.3 V logic (touch/SD optional, not used) | 1 | Matches the existing pinout (CS 10, DC 11, RST 12, SCK 14, MOSI 21, MISO 13). |
| 5 | Buzzer | **Passive** piezo buzzer, 12 mm (firmware uses `tone()`) | 1 | An *active* buzzer would not play the firmware's tones correctly. |
| 6 | Buzzer driver (recommended) | NPN transistor S8050 / 2N2222 + 1 kΩ base resistor | 1 set | Louder and protects the GPIO. A 3-pin passive buzzer module with onboard transistor also works. |
| 7 | Reminder LED | 5 mm LED (mint/green or blue) + 220–330 Ω resistor | 2 | One spare. |
| 8 | Silence button | 12 mm momentary push button (panel mount, round cap) | 1 (+1) | Wired GPIO 38 → GND, internal pull-up; no external resistor needed. |
| 9 | Decoupling | 100 µF electrolytic + 100 nF ceramic capacitors | 3 each | Near the HX711 and display supply to reduce noise. |
| 10 | Power supply | 5 V / 2 A USB-C wall adapter + good USB-C cable | 1 | Powers the DevKit via USB. |

## 2. Wiring and assembly supplies

- Half-size breadboard + male–female/male–male Dupont jumpers (bench testing first).
- Perfboard/protoboard (≈ 5×7 cm) for the permanent build.
- 22–26 AWG silicone stranded wire, assorted colours.
- JST-XH 2.54 mm connectors (4-pin for load cell, 2-pin for buzzer/LED/button) so modules unplug.
- Male/female pin headers, heat-shrink tubing, small zip ties.
- Optional: short shielded 4-core cable for the load-cell lead (reduces noise).

## 3. Calibration and test materials (no real medication)

- **Calibration weight set** (e.g. 1 g – 100 g, class M1 or better).
- Reference digital scale with **0.01 g** resolution.
- **Inert test tablets**: identical items of known mass (e.g. glass beads or consistently filled empty capsules). Weigh 20+ to learn the real per-item spread.
- Digital calipers (for measuring every part before CAD).

## 4. Case fabrication

- **Recommended method: FDM 3D printing in PETG** (stiffer and more heat-tolerant than PLA). PLA is fine for early fit-test prints.
- **Pill cup: buy, don't print.** A food-safe polypropylene (PP) cup or one removable compartment from a commercial pill organizer. FDM prints have crevices and aren't reliably food-safe. The case only needs a holder for it.
- M3 brass heat-set inserts (≈ 30) + M3 screws, 6/8/10/12 mm (assorted kit).
- Load-cell screws: size per the load-cell datasheet (mini bar cells are usually M3/M4 at one end and M4/M5 at the other — **check yours**). Add washers.
- M2.5/M3 nylon standoffs for the ESP32, HX711 and protoboard.
- 4 adhesive rubber feet (≥ 10 mm, non-slip).
- Optional: small brass hinge pin (2–3 mm rod) or a magnetic lid (2 × 6×2 mm neodymium magnets).
- Tools: soldering iron + solder, multimeter, wire stripper, flush cutters, small screwdrivers, a soldering-iron tip for heat-set inserts.

## 5. Optional / later phase (not needed for the first build)

- **DS3231 RTC module** — keeps time for reminders after power loss without Wi-Fi.
- Battery backup (18650 cell + protected charger/boost module, or a USB power bank). Lithium cells need a protected charger and an enclosure designed for them — defer until basic operation is proven.
- Light pipe / diffuser rod (3–5 mm acrylic) for the LED.

### Important finding for calibration

The current firmware treats a weight change as a removal only if it is at least
`max(1.5 g, 0.6 × pillWeightG)` (`sketch.ino:127`), with a demo pill weight of 5 g.
Many real tablets weigh 0.1–1 g, so single-tablet removals would currently be
ignored. Measure real noise and per-tablet mass on the bench before changing this.

---

## 6. Case parts (what each image prompt covers)

Concept layout: a compact desktop box (starting estimate ≈ 140 W × 110 D × 95 H mm,
to be replaced by measured dimensions). The display faces forward at a slight
upward tilt. The pill cup sits in a well on top under a lid. Electronics are in the
base.

**Weighing rule:** the cup and its carrier must touch **only the load cell**.
The lid, walls and display must never rest on them. Leave a 2–3 mm air gap all
around the floating parts.

| # | Part | Function |
|---|------|----------|
| P1 | Base shell (bottom housing) | Holds electronics, load-cell mount, USB-C opening, feet |
| P2 | Load-cell fixed mounting block | Rigid pillar bolting the cell's fixed end to the base floor |
| P3 | Overload stop | Hard stop under the floating end so a heavy press can't bend the cell |
| P4 | Floating weighing platform (cup carrier) | Bolted to the cell's free end; holds the cup |
| P5 | Removable pill cup (bought) + keyed holder ring | Contains tablets; lifts out for refilling |
| P6 | Top shell (upper housing) | Encloses everything; has the cup well with an air gap |
| P7 | Lid | Covers the cup; hinged or magnetic, attached to the top shell only |
| P8 | Display front bezel | Frames the 2.8" TFT with a window |
| P9 | Display mounting bracket | Holds the TFT module behind the bezel |
| P10 | Electronics tray | Standoff plate for ESP32-S3, HX711 and protoboard |
| P11 | Button cap and mount | Large, easy-press silence button |
| P12 | LED light pipe / diffuser window | Makes the reminder light visible from the front and top |
| P13 | Buzzer grille and holder | Lets sound out; holds the piezo |
| P14 | USB-C port bezel and cable strain relief | Clean port opening; stops the cable pulling on the board |
| P15 | Bottom service cover | Removable plate for wiring access and calibration |
| — | Full assembly + exploded view | Shows how all parts fit |

---

## 7. Image-generation prompts

Each prompt is self-contained: copy one into an image generator (ChatGPT image,
Midjourney, Gemini, etc.). They share one style so the set looks consistent.
For Midjourney, append `--ar 4:3 --style raw`.

**Shared style (already included in each prompt):** clean studio product render,
matte off-white plastic with soft mint-green and calm blue accents (no orange),
rounded friendly medical-device styling, soft shadows, plain light-grey
background, isometric three-quarter view, no text, no logos, no people, no real
medication.

### Full assembly

> Product concept render of a compact desktop smart pill box for one medication container, about 14 cm wide, 11 cm deep and 9.5 cm tall. Rounded matte off-white plastic body with soft mint-green and calm blue accents. A 2.8 inch colour screen on the slightly tilted front face, a large round mint silence button below it, a small glowing mint LED window, and a subtle speaker grille. A hinged rounded lid on top over a removable round pill cup. USB-C cable entering at the back. Friendly, simple medical-device design. Clean studio lighting, soft shadows, plain light-grey background, three-quarter isometric view, no text, no logos, no people, no orange.

### Exploded view

> Exploded-view technical illustration of a compact desktop smart pill box, parts floating apart vertically along a central axis with thin dashed alignment lines: rounded off-white base shell with rubber feet, a small electronics tray holding a microcontroller board and a tiny amplifier board, a straight bar load cell bolted to a rigid mounting block, a floating round weighing platform on the free end of the load cell, a removable round translucent pill cup, the upper housing with a circular well, a hinged lid, a front bezel framing a 2.8 inch screen, a round button cap and a small light pipe. Matte off-white plastic with mint-green and calm blue accents, clean studio render, plain light-grey background, no text, no labels, no people, no orange.

### P1 — Base shell

> Product render of a single 3D-printed base shell for a small desktop electronics box, about 14 by 11 cm and 3 cm tall, open top, rounded corners, matte off-white plastic. Inside: a raised rectangular mounting pad with two screw holes for a load cell block, four short cylindrical screw bosses for an electronics tray, a rectangular USB-C opening in the rear wall, small ventilation slots on one side, and four shallow round recesses underneath for rubber feet. Thin mint-green accent line around the top edge. Studio lighting, soft shadows, plain light-grey background, three-quarter top view showing the inside, no text, no logos, no orange.

### P2 — Load-cell fixed mounting block

> Close-up product render of a small rigid 3D-printed mounting block for a straight bar load cell, a solid rectangular pillar with ribbed side supports, two vertical bolt holes on top and a flat base flange with two screw holes, matte off-white PETG plastic with a mint-green accent. Shown with a silver aluminium mini bar load cell bolted to its top at one end, the other end of the load cell extending freely into the air with a visible gap below it. Clean engineering-style studio render, plain light-grey background, three-quarter view, no text, no orange.

### P3 — Overload stop

> Close-up product render of a small 3D-printed overload stop for a load cell: a short off-white plastic post with a rounded top positioned a few millimetres below the free end of a silver mini bar load cell, leaving a small visible air gap, so the load cell cannot bend too far if pressed. Mint-green accent on the post, matte finish, clean engineering studio render, plain light-grey background, side three-quarter view, no text, no orange.

### P4 — Floating weighing platform (cup carrier)

> Product render of a round 3D-printed weighing platform, about 7 cm diameter, matte off-white plastic, with a shallow circular recess on top to hold a removable cup, a small alignment notch on the rim, and an underside boss with two bolt holes that attaches to the free end of a mini bar load cell. Thin calm-blue ring around the rim. Show it slightly tilted to reveal both top and underside features. Clean studio render, soft shadows, plain light-grey background, no text, no orange.

### P5 — Removable pill cup and keyed holder ring

> Product render of a small removable round pill cup made of translucent food-safe polypropylene, about 6 cm diameter and 4 cm deep, with smooth rounded inner corners and a small finger tab, sitting in a thin matte off-white keyed holder ring with an alignment notch. The cup is empty. Soft mint-green tint on the holder ring. Clean studio lighting, soft shadows, plain light-grey background, three-quarter view, no pills, no text, no orange.

### P6 — Top shell (upper housing)

> Product render of the upper housing of a compact desktop smart pill box, matte off-white rounded plastic shell about 14 by 11 cm, with a circular well opening on top for a pill cup surrounded by a visible narrow air-gap ring, a sloped front face with a rectangular window for a 2.8 inch screen, a round opening for a large button below it, a small slot for an LED light pipe, and a perforated speaker grille on one side. Calm-blue accent around the cup well. Shown on its own, three-quarter view, clean studio render, plain light-grey background, no text, no orange.

### P7 — Lid

> Product render of a rounded hinged lid for a small desktop pill box, matte off-white plastic, gently domed top with a subtle mint-green finger recess at the front edge, a small barrel hinge at the back, and two tiny circular magnet pockets on the underside. Shown half open on its own, three-quarter view, clean studio lighting, soft shadows, plain light-grey background, no text, no logos, no orange.

### P8 — Display front bezel

> Product render of a 3D-printed front bezel for a 2.8 inch rectangular colour display, matte off-white plastic with softly rounded outer corners, a rectangular viewing window with a thin chamfer, four small screw holes in the corners, and a thin calm-blue accent frame around the window. Front three-quarter view, clean studio render, plain light-grey background, no text, no orange.

### P9 — Display mounting bracket

> Product render of a 3D-printed rear mounting bracket for a 2.8 inch SPI display module, a flat off-white plastic frame with four standoffs that hold the display circuit board, side clips, a cut-out for the pin header and ribbon wires, and two mounting tabs with screw holes. Shown holding a generic red display circuit board from behind. Clean engineering studio render, plain light-grey background, rear three-quarter view, no text, no orange.

### P10 — Electronics tray

> Product render of a flat 3D-printed electronics tray, matte off-white plastic plate about 10 by 7 cm with raised standoffs holding a long slim microcontroller development board with a USB-C port, a small green load-cell amplifier board and a small perfboard, plus zip-tie slots and cable channels along the edges. Mint-green accent on the tray edge. Top three-quarter view, clean studio lighting, plain light-grey background, no readable text, no orange.

### P11 — Button cap and mount

> Close-up product render of a large round push-button cap, about 2 cm diameter, soft-touch mint-green plastic with a slightly concave top and a subtle raised bell-silence symbol, seated in a matte off-white ring-shaped panel mount with a retaining clip behind it. Easy to press for older hands. Clean studio lighting, plain light-grey background, three-quarter view, no text, no orange.

### P12 — LED light pipe / diffuser window

> Close-up product render of a small frosted translucent light pipe and diffuser window for a pill box status light, a short clear acrylic rod leading from a 5 mm LED to a soft rounded mint-glowing window in a matte off-white plastic panel. Gentle mint glow, clean studio lighting, plain light-grey background, three-quarter view, no text, no orange.

### P13 — Buzzer grille and holder

> Close-up product render of a small speaker grille on a matte off-white plastic panel, a neat circular pattern of small round perforations, with a snap-fit cup-shaped holder behind it holding a 12 mm round black piezo buzzer. Thin calm-blue accent ring around the grille. Clean studio lighting, plain light-grey background, three-quarter view showing front and back, no text, no orange.

### P14 — USB-C port bezel and cable strain relief

> Close-up product render of the rear of a small off-white plastic electronics box showing a neat rounded rectangular USB-C port bezel with a USB-C cable plugged in, and an internal 3D-printed cable clamp with a screw that holds the cable to prevent pulling on the circuit board. Mint-green accent around the port. Clean studio lighting, plain light-grey background, rear three-quarter view, no text, no logos, no orange.

### P15 — Bottom service cover

> Product render of the underside of a small desktop electronics box, showing a removable flat bottom service cover held by four countersunk screws, four round non-slip rubber feet, small ventilation slots, and a blank recessed rectangle for a label. Matte off-white plastic with a mint-green accent line. Clean studio lighting, plain light-grey background, bottom three-quarter view, no text, no orange.

---

## 8. Before real CAD

Measure each part with calipers (or take datasheet drawings) and record:
ESP32-S3 board outline and USB position, HX711 board outline and hole spacing,
load-cell length, hole positions and thread sizes, display PCB outline, active
area and mounting holes, button/buzzer/LED diameters, the chosen pill cup's
outside diameter and height, and the printer bed size. Those numbers replace the
starting-estimate envelope above.
