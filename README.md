# CRP-5 Emulator

A free, open-source, in-browser emulator of the **CRP-5 style circular navigation computer** that ATPL ground school and theory exams expect students to use. It has both sides of the instrument: the circular slide rule with its airspeed, altitude and conversion windows, and the wind side with a rotating plotting disc and a double-sided speed slide.

> **Independent project.** This emulator is not affiliated with, endorsed by or sponsored by the maker of the CRP-5 or any other flight equipment company. "CRP-5" is used only to say which type of navigation computer this emulates, because ATPL training and examination material refers to it by that name. Any trademarks belong to their owners. All artwork, code and text in this repository are original; no manufacturer logos, artwork or documentation are included.
>
> For study only. Not for real-world navigation.

## Features

**Calculator side (circular slide rule)**
- Outer fixed and inner rotating log scales, graduated like the real instrument (0.1 to 15, 0.2 to 30, 0.5 above), with a draggable hairline cursor.
- ▲60 speed index for speed, distance, time and fuel, plus a minutes-to-hours ring.
- Red unit datums: km · m · litres, yards, feet, m/s, nautical and statute miles, imperial and US gallons, kg and lb, with specific-gravity scales for converting fuel volume to mass.
- **Air Speed** window: pressure altitude against COAT gives TAS from CAS. It also has the **Mach No. Index** for TAS from Mach number and the local speed of sound.
- **Comp Corr** window for TAS above 300 kt (TAS/100 − 3 divisions).
- **Density Altitude** and **Altitude** (true altitude) windows.
- **Temp Rise** (kinetic heating) scale and a °C/°F conversion scale.

**Wind side (triangle of velocities)**
- TRUE HEADING index with a ±50° drift/variation scale.
- Rotating compass ring and window disc you can mark with a pencil: crosses, freehand, and straight lines that can be laid exactly along a drift line (for finding the wind from drift on two headings). Marks can be rubbed out or undone.
- Double-sided slide: **L** (40–300 kt, with a square grid for runway components) and **H** (150–1000 kt). Drift lines are 2° apart at low speed and 1° apart higher up. The calculator side shows the other face of the same slide.

**Emulator extras**
- **Set precisely** boxes make the same physical moves with exact numbers (for example "set inner 60 against outer 150" or "pencil a cross 30 kt below the dot").
- A **Readouts** panel shows exact values for the current setting, so you can check what you read off the scales. Hide it to practise.
- Zoom, pan, and turn the whole computer to read upside-down numbers. Shift-drag for fine movement. Works with mouse, touch and keyboard.
- Works offline once loaded (installable PWA), and remembers its last setting.

## Using it

Open the hosted page, or run it locally (below). Short how-tos with worked examples for every function are built into the app's side panel.

| Key | Action |
| --- | --- |
| `F` | Flip between calculator and wind side |
| `←` `→` | Turn the disc (`Shift` × 10) |
| `[` `]` | Move the cursor (calculator side) |
| `↑` `↓` | Move the slide (wind side) |
| `M` `P` `L` `E` | Move, pencil, line, rubber |
| `⌘`/`Ctrl` + `Z` | Undo the last pencil mark |
| `+` `−` `0` | Zoom in, out, reset view |
| `R` | Turn the whole computer 90° |

## How accurate is it?

Every window is generated from the same relationship as the slide rule, so the windows, scales and readouts can't disagree. The scales are computed from first principles, not traced from a photo:

- **TAS, density altitude, Mach:** the ICAO Standard Atmosphere. The Air Speed window gives TAS = CAS / √σ exactly, and the Mach index gives TAS = M × 38.97 √T. As on the real computer, the pressure-altitude scale carries on to 80,000 ft. The density-altitude scale runs from −6,000 to 70,000 ft with a gap between. It is ISA density altitude up to the tropopause, then opens out above it to match photographs of the real scale (64,700 ft with inner 21.75 against outer 10, and 1,000 ft divisions about 10° apart there).
- **True altitude:** indicated × T / T<sub>ISA</sub>(pressure altitude), the usual computer approximation. The Altitude window runs to 36,000 ft (the tropopause).
- **Comp Corr:** the numbers count divisions. They stop at 0, which sits under the arrow with inner 21.75 against outer 10, as photographed on a real CRP-5. They also read 38.2 at FL350 / −47 °C, as in the common training example. The way division size grows with altitude comes from the compressible-flow equations. Fitted to those two points, the divisions come out at about 3.2° at FL350 and 4.1° next to the 0, which matches both sources independently. Like the real instrument, the "TAS/100 − 3" rule then lands within about 2% of the exact TAS (`tests/calcscales.test.js`).
- **Temp Rise:** a log–log scale of ΔT = r·V²/2c<sub>p</sub> with a recovery factor of 0.8, for TAS 100–1000 kt.
- **Wind side:** speed arcs are circles about the zero-speed origin and drift lines radiate from it, so the vector solution is geometrically exact on both faces (the H face is drawn at 3/8 of the L scale).

The calculator side's layout and colours closely follow the real instrument: window positions, the orange hours band, the log–log Temp Rise scale and the red datums. The branding and artwork are this project's own, and some scale details (for example the Comp Corr numbering, which the real computer doesn't document) are derived independently. Always use your training organisation's material as the reference for exam technique.

Not included yet: the wind arm of the CRP-5W variant, and the rulers along the slide edges.

## Running locally

It is a static site with no build step and no dependencies. ES modules need to be served over HTTP. Any static server works; the included one turns off browser caching so your edits always show:

```bash
python3 scripts/dev-server.py
```

Then open <http://localhost:8091>.

Run the tests (Node 20+):

```bash
npm test
```

## Publishing on GitHub Pages

The workflow in `.github/workflows/pages.yml` runs the tests and deploys the site on every push to `main`. To turn it on, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. The app's "Source code" link points itself at the repository when it is served from `<user>.github.io/<repo>/`.

## Project layout

```
index.html            App shell, side panel and built-in guide
css/style.css         Styles (app chrome follows light/dark; the instrument does not)
js/main.js            State, input handling, readouts
js/calculator.js      Draws the calculator side
js/wind.js            Draws the wind side
js/slide.js           Draws the L and H slide faces
js/body.js            The shared plastic body
js/calcscales.js      Calculator-side geometry (pure functions, tested)
js/windmath.js        Wind-side geometry (pure functions, tested)
js/atmosphere.js      ISA and airspeed relations (pure functions, tested)
js/viewport.js        Zoom, pan and view rotation
js/svg.js             SVG helpers
sw.js                 Offline cache
scripts/dev-server.py No-cache local server for development
tests/                node:test unit tests
```

## Contributing

Issues and pull requests are welcome, especially corrections from instructors and students who use the real instrument daily. Please keep the artwork original: don't contribute scans, photos or traced artwork of commercial products.

## Licence

[MIT](LICENSE) © 2026 James Thompson and contributors.
