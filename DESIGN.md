---
name: COVENANT
description: A public proof instrument for evidence-conditioned Creditcoin facilities.
colors:
  cobalt-thread: "#2457ce"
  cobalt-deep: "#153f9f"
  oxblood-seal: "#8a2636"
  verified-mint: "#247556"
  caution-amber: "#8b6420"
  midnight-ink: "#10233e"
  soft-ink: "#43536a"
  faint-ink: "#566171"
  security-paper: "#f3efe2"
  paper-deep: "#e9e2d1"
  paper-bright: "#faf7ed"
  engraved-line: "rgba(16, 35, 62, 0.25)"
  hairline: "rgba(16, 35, 62, 0.12)"
typography:
  display:
    fontFamily: "Covenant Display, Georgia, serif"
    fontSize: "clamp(62px, 5.6vw, 92px)"
    fontWeight: 400
    lineHeight: 0.88
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Covenant Display, Georgia, serif"
    fontSize: "clamp(50px, 6vw, 92px)"
    fontWeight: 400
    lineHeight: 0.94
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Covenant Display, Georgia, serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Covenant Sans, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "9px"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "0.12em"
rounded:
  square: "0px"
  precision: "2px"
  medallion: "999px"
spacing:
  micro: "8px"
  compact: "12px"
  base: "16px"
  block: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.midnight-ink}"
    textColor: "{colors.paper-bright}"
    typography: "{typography.label}"
    rounded: "{rounded.precision}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-deep}"
    textColor: "{colors.paper-bright}"
    typography: "{typography.label}"
    rounded: "{rounded.precision}"
    padding: "0 20px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.midnight-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.precision}"
    padding: "0 20px"
    height: "48px"
  status-verified:
    backgroundColor: "transparent"
    textColor: "{colors.verified-mint}"
    typography: "{typography.label}"
    rounded: "{rounded.precision}"
    padding: "6px 10px"
    height: "31px"
  evidence-field:
    backgroundColor: "{colors.security-paper}"
    textColor: "{colors.midnight-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "11px"
    height: "46px"
---

# Design System: COVENANT

## Overview

**Creative North Star: "The Security Print Instrument"**

COVENANT treats public protocol evidence as a financial instrument, not a dashboard. Warm security stock, engraved rules, serial notation, guilloche fields, a woven cobalt thread, and an oxblood verification seal give public records the visual weight of an issued document. The finish stays crisp and contemporary. Ornament always supports sequence, authenticity, or inspection.

The system leads with financial consequence and preserves a strict distinction between verified, pending, local, skipped, and rejected evidence. Large editorial type makes the causal claim readable. Compact sans-serif and monospaced labels carry technical detail, network state, serials, and status without competing with the proof story.

**Key Characteristics:**

- Warm ivory security stock with midnight engraved structure.
- A 30/70 editorial dossier and proof-instrument split on wide screens.
- Cobalt threads and medallions express causal sequence.
- Oxblood seals mark verification and rejection boundaries.
- Mint indicates verified public state, with text labels beside every color state.
- Real explorer links appear as serial ledger entries, never promotional cards.

## Colors

The palette reads as institutional ink on security paper, with scarce color reserved for proof mechanics and evidence state.

### Primary

- **Cobalt Security Thread** (`cobalt-thread`): Carries linked actions, stage numbers, focus, selection, and the vertical proof path.
- **Deep Cobalt Ink** (`cobalt-deep`): Supplies active and hover depth while preserving the same proof identity.

### Secondary

- **Oxblood Proof Seal** (`oxblood-seal`): Marks issued proof, rejected cases, risk boundaries, and destructive protocol actions.

### Tertiary

- **Verified Mint** (`verified-mint`): Marks inspected public records and successful contract state.
- **Caution Amber** (`caution-amber`): Marks warnings and unconfigured operator state.

### Neutral

- **Midnight Engraving Ink** (`midnight-ink`): Primary text, keylines, dark actions, and the footer field.
- **Soft Ledger Ink** (`soft-ink`): Supporting copy and secondary values.
- **Faint Serial Ink** (`faint-ink`): Metadata and quiet labels. Use only where the established contrast remains compliant.
- **Security Paper** (`security-paper`): Page field and input stock.
- **Deep Paper Fiber** (`paper-deep`): Subordinate bands, warnings, and table headers.
- **Bright Instrument Stock** (`paper-bright`): Dossiers, proof surfaces, and ledger cells.
- **Engraved Rule** (`engraved-line`): Primary interior dividers.
- **Hairline Rule** (`hairline`): Secondary dividers and microstructure.

### Named Rules

**The Ink Economy Rule.** Cobalt describes evidence flow, oxblood describes consequence, and mint describes verified state. Do not use these colors as unrelated decoration.

**The State Needs Language Rule.** Every state color ships with an explicit label such as VERIFIED, REJECTED, PENDING, LOCAL, or SKIPPED.

## Typography

**Display Font:** Covenant Display, self-hosted Libre Caslon Display, with Georgia fallback

**Body Font:** Covenant Sans, self-hosted Public Sans, with Arial fallback
**Label/Mono Font:** Native monospaced system stack

**Character:** The display face provides issued-document authority and compact editorial drama. Public Sans keeps explanation direct. Monospaced labels make addresses, serials, states, and network metadata scan as records.

### Hierarchy

- **Display:** Large, tightly set, and limited to the core proposition inside the dossier.
- **Headline:** Editorial page titles and major section statements with balanced wrapping.
- **Title:** Instrument stages, metrics, proof steps, and panel headings.
- **Body:** Explanatory copy. Keep important paragraphs near 42 to 78 characters per line.
- **Label:** Uppercase serials, network labels, evidence states, and control metadata with wide tracking.

### Named Rules

**The Two Voices Rule.** Use the serif for meaning and consequence. Use sans or mono for evidence, operation, and state.

**The Label Discipline Rule.** Small uppercase labels remain short. Full sentences belong in body text.

## Layout

The page container reaches up to 1540px and keeps a 16px outer gutter on wide screens. The signature dossier uses a 30/70 split, with a narrow editorial lead and a dominant proof instrument. Engraved borders connect adjacent sections so the page reads as one issued record rather than a stack of floating cards.

At 1100px, the dossier shifts to a 34/66 split, six-column ledgers become three columns, and supporting grids reduce their column count. At 760px, the dossier becomes one column, the ledger becomes a vertical record, content receives an 8px to 12px viewport gutter, tables collapse into labeled rows, and navigation remains horizontally reachable. The mobile proof thread moves left of center so stage names and inspection controls retain readable width.

Spacing follows a compact document rhythm. Use 8px and 12px for internal evidence detail, 16px and 24px for controls and cells, and 32px or larger for major section separation. Adjacent evidence sections normally share a border instead of adding empty gaps.

**The Continuous Instrument Rule.** Related proof, state, and evidence sections touch and share keylines. Do not split one causal record into detached cards.

## Elevation & Depth

The system stays flat by default. Depth comes from paper tone, double keylines, inset rules, guilloche layers, and faint printed fields. The main dossier receives a restrained ambient shadow. The moving thread seal and final proof seal receive small shadows so their position reads above the printed stock.

### Shadow Vocabulary

- **Dossier ambient:** A broad low-opacity navy shadow under the full proof instrument.
- **Moving seal lift:** A compact navy shadow under the active thread medallion.
- **Issued seal lift:** A compact oxblood-tinted shadow under the final verification seal.

### Named Rules

**The Printed-First Rule.** Use rules, tone, and linework before shadow. Only the issued instrument and movable proof marks sit above the paper.

## Shapes

Primary containers use square corners and exact one-pixel or double engraved borders. Buttons and state pills use a restrained 2px radius. Circles belong to verification medallions, status lights, rosettes, and seals. Stage rows receive asymmetric cobalt and oxblood corner marks to resemble security-print registration details.

Guilloche curves and rosettes remain thin, low contrast, and subordinate to text. The toothed proof seal is the strongest silhouette. It appears only where a completed verification record warrants it.

**The Geometry Has Meaning Rule.** Rectangles hold records, circles authenticate them, and the vertical thread connects causality.

## Components

### Buttons

- **Shape:** Compact precision corners with a 1px ink border.
- **Primary:** Midnight fill on bright paper with dense, high-weight labeling.
- **Hover / Focus:** Hover lifts by 2px and deepens to cobalt. Keyboard focus uses a 3px cobalt outline with a 3px offset.
- **Ghost:** Transparent paper, midnight border, and a faint ink wash on hover.
- **Danger:** Oxblood fill and border, reserved for irreversible or rejection-adjacent operator actions.

### Status Pills

- **Style:** Transparent paper, current-color border, compact mono label, and a 2px radius.
- **State:** Neutral uses soft ink, verified uses mint, warning uses amber, rejection uses oxblood, and proof-related status uses cobalt.

### Cards / Containers

- **Corner Style:** Square instrument corners.
- **Background:** Bright instrument stock for primary reading, deep paper for subordinate bands, and midnight for high-consequence calls to action.
- **Shadow Strategy:** Flat except for the signature dossier.
- **Border:** One-pixel engraved keylines. Signature instruments use double inner frames.
- **Internal Padding:** 24px to 30px on desktop, 16px to 22px on mobile.

### Inputs / Fields

- **Style:** Security-paper fill, square 1px engraved border, monospaced values, and 11px internal padding.
- **Focus:** Cobalt border with an inset cobalt keyline.
- **Error / Disabled:** Errors and destructive actions use oxblood. Disabled controls reduce opacity while retaining their label.

### Navigation

Navigation sits inside the document masthead for instrumented pages and inside a framed top bar elsewhere. Items use restrained sans-serif labels, shared dividers, and a faint cobalt wash on hover. On mobile, all five destinations stay visible inside the dossier masthead. Generic pages retain a horizontally scrollable fallback.

### Proof Dossier

The signature component pairs the editorial claim with one six-stage proof instrument. A woven cobalt thread passes through rosette medallions, while pointer position and keyboard focus move a proof seal along the resolved sequence. Reduced-motion mode fixes the record at its completed state and reduces all transition durations to near zero.

### Serial Evidence Ledger

Each public link includes a medallion, serial identifier, evidence label, and authored line icon. Wide screens show six equal entries, medium screens show two rows of three, and mobile shows one entry per row. Missing records keep their place and state PENDING instead of disappearing.

### Evidence Tables and Rehearsal

Attack results, proof steps, and the judge rehearsal use the same engraved rows and explicit state vocabulary. The rehearsal labels itself as visual. Live evidence remains linked to public explorers. Local and skipped records retain their distinct wording.

## Do's and Don'ts

### Do:

- **Do** lead public pages with one financial consequence and its causal proof record.
- **Do** keep explorer links, transaction identifiers, contract state, and rejection evidence independently inspectable.
- **Do** preserve explicit REAL, LOCAL, SKIPPED, PENDING, VERIFIED, and REJECTED language.
- **Do** use authored SVG line icons, rosettes, guilloche fields, and seals.
- **Do** preserve keyboard focus, mobile reading order, and reduced-motion completion.
- **Do** use ornament to clarify authenticity, sequence, or state.

### Don't:

- **Don't** convert evidence into dashboard tiles, rounded app cards, charts, token art, or generic crypto imagery.
- **Don't** use gradients, glass effects, neon, photographic paper, or heavy vintage distressing.
- **Don't** detach the serial ledger from the proof instrument it documents.
- **Don't** use color as the only status signal.
- **Don't** invent transaction state, financial performance, borrower behavior, or production-readiness claims.
- **Don't** add motion without a causal or navigational purpose.
