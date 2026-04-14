# Sport Tech Design System: Editorial Performance Dashboard

## 1. Overview & Creative North Star: "The Kinetic Lab"
This design system is built for the high-performance athlete who views their body as a high-precision machine. The Creative North Star is **"The Kinetic Lab"**—an aesthetic that merges the raw energy of professional sport with the cold, calculated precision of a data laboratory. 

Unlike standard dashboards that rely on rigid grids and boxy containers, this system utilizes **Intentional Asymmetry** and **Tonal Depth**. We move away from "app-like" templates toward a "High-End Editorial" experience. Layouts should feel like a premium sports magazine met a fighter jet HUD: expansive, high-contrast, and unapologetically technical. By overlapping data visualizations and using unconventional typographic scales, we create a sense of forward motion.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a "Deep Space" high-contrast dark theme. Colors are not just aesthetic; they are **functional beacons** that categorize the athlete's life.

### Functional Mapping
- **Primary (`#f3ffca`):** Tennis & High-Agility. Use for peak performance metrics.
- **Secondary (`#6a9cff`):** Water Sports (Wingfoil, Surf). Use for fluid, flow-state data.
- **Tertiary (`#ff7439`):** Gym & Power Training. Use for high-intensity, explosive metrics.
- **Surface Tints:** Use `surface-container` tiers to distinguish recovery and sleep (Soft Green leanings).

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Boundaries must be defined through:
1.  **Background Color Shifts:** A `surface-container-low` (`#131313`) card sitting on a `surface` (`#0e0e0e`) background.
2.  **Vertical Rhythm:** Using the Spacing Scale (e.g., `16` / `3.5rem`) to create "islands" of information.

### The "Glass & Gradient" Rule
To achieve a premium "Sport Tech" feel, use **Glassmorphism** for floating overlays. Apply `surface-container-highest` with a 60% opacity and a `20px` backdrop-blur. 
*   **Signature Texture:** Apply subtle linear gradients (e.g., `secondary` to `secondary-container`) for progress bars and active state activity rings to provide "visual soul."

---

## 3. Typography: The Athletic Typeface
We use a tri-font system to balance technical precision with editorial impact.

- **Display & Headlines (`Space Grotesk`):** A rhythmic, wide-aperture sans-serif. Use `display-lg` (`3.5rem`) for hero metrics (e.g., Max Heart Rate) to create a bold, "poster-like" impact.
- **Titles & Body (`Inter`):** The workhorse. `inter` provides maximum legibility for data-heavy tables and analytical paragraphs. 
- **Labels (`Lexend`):** Used for micro-copy and axis labels. Its geometric clarity ensures that even at `label-sm` (`0.6875rem`), the data remains professional and readable.

**Editorial Tip:** Use `headline-lg` in all-caps with `0.05em` letter-spacing for section titles to evoke a sense of professional sports branding.

---

## 4. Elevation & Depth: Tonal Layering
In "The Kinetic Lab," depth is physical, not simulated with heavy shadows.

- **The Layering Principle:** Stacking defines importance.
    - **Base:** `surface` (`#0e0e0e`)
    - **Sections:** `surface-container-low` (`#131313`)
    - **Interactive Cards:** `surface-container` (`#1a1a1a`)
    - **Floating Modals:** `surface-bright` (`#2c2c2c`)
- **Ambient Shadows:** For floating action buttons or high-priority alerts, use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(0,0,0,0.4)`.
- **The "Ghost Border" Fallback:** If accessibility requires a stroke, use `outline-variant` (`#484847`) at **15% opacity**. It should be felt, not seen.

---

## 5. Components & Data Visualization

### Activity Rings & Gauges
- **Stroke:** Use `primary`, `secondary`, or `tertiary` based on the sport category.
- **Background:** Use `surface-variant` (`#262626`) as the "track" for the ring.
- **Glow:** Apply a subtle drop-shadow in the color of the metric (e.g., orange glow for Gym) to simulate an illuminated LED display.

### Action Buttons
- **Primary:** `primary` background with `on_primary_fixed` text. Sharp corners (`sm`: `0.125rem`) to maintain the "technical" edge.
- **Secondary:** Ghost style. No background, `outline` stroke at 20% opacity, `on_surface` text.

### Performance Cards
- **Rule:** Absolutely no divider lines.
- **Structure:** Use `surface-container-low` with `xl` (`0.75rem`) corner radius. Group related data points using `2.5` (`0.5rem`) spacing. 
- **Interaction:** On hover, shift background to `surface-container-high`.

### Technical Input Fields
- **Style:** Underline-only or subtle `surface-container-highest` fills. 
- **Focus State:** Transition the underline to `primary` (`#f3ffca`) with a tiny `primary_dim` "blip" or indicator light in the corner.

---

## 6. Do’s and Don’ts

### Do
- **Use "Mega-Typography":** Make the most important number (e.g., Training Readiness) massive (`display-lg`).
- **Leverage Asymmetry:** Offset a line chart to the right while keeping the summary text pinned to the far left.
- **Use Functional Color:** Only use `secondary` (Blue) for water-related data. Never use it for Gym metrics.

### Don’t
- **Don’t use 100% white for body text:** Use `on_surface_variant` (`#adaaaa`) for secondary descriptions to maintain the dark-room aesthetic.
- **Don’t use Rounded-Full (Pills) for everything:** Keep the vibe "Technical" by sticking to `sm` and `md` corner radii for cards and buttons.
- **Don’t use standard Grid Gaps:** Use the Spacing Scale to create "breathing rooms"—large gaps between different sport modules (e.g., `24` / `5.5rem`).

---

## 7. Data Visualization Specifics
- **Line Charts:** Use a 2px stroke. Fill the area below the line with a `0.1` opacity gradient of the same stroke color.
- **Bar Graphs:** Use `DEFAULT` (`0.25rem`) rounding on the top of bars only. 
- **Empty States:** Instead of a generic icon, use a wireframe "technical drawing" style illustration in `outline` color.