# Design System Guide

Use this file as the durable visual and UX contract for the app.

## Product Feel

- Build a practical, work-focused interface.
- Prioritize clarity, trust, and repeat use over decorative presentation.
- Make the first screen useful immediately. Avoid marketing-style filler unless the user explicitly asks for a landing page.
- Keep information dense enough for operations, but leave enough spacing for scanning.
- Choose the design direction from the product domain first, then pick colors, type, spacing, motion, and component density to support that domain.
- Avoid default "AI app" styling unless the product itself calls for it.

## Layout

- Use stable dimensions for controls, tables, boards, charts, and cards so content changes do not cause layout jumps.
- Use full-width sections or constrained app shells for major areas.
- Use cards only for repeated items, modals, or genuinely framed tools. Avoid cards nested inside cards.
- Ensure every important workflow has clear empty, loading, success, and error states.
- Design mobile and desktop together. Text and controls must not overlap at any viewport.
- For dashboards and operational screens, favor clear navigation, tables, filters, summaries, charts, and repeatable actions over oversized hero sections.
- Put primary actions where users naturally finish scanning the relevant content.

## Visual Language

- Avoid one-note palettes dominated by a single hue family.
- Use restrained contrast, clear hierarchy, and purposeful accents.
- Keep border radius at 8px or less unless an existing component requires otherwise.
- Use lucide icons for recognizable actions and place them inside icon buttons where appropriate.
- Use text buttons only for clear commands that benefit from labels.
- Define colors by role: background, surface, border, muted text, primary action, destructive action, success, warning, and focus.
- Avoid industry anti-patterns: playful colors for serious finance/security flows, low contrast in data-heavy views, and decorative motion during repeated work.

## Components

- Use icons for common tools such as save, edit, delete, search, filter, close, next, previous, undo, and redo.
- Use toggles or checkboxes for binary settings.
- Use segmented controls, tabs, or menus for mutually exclusive modes.
- Use sliders, steppers, or inputs for numeric values.
- Use swatches or token pickers for color choices.
- Provide tooltips for unfamiliar icon-only controls.
- Specify component states when editing shared UI: default, hover, active, focus, disabled, loading, error, and selected.
- Minimum interactive target should be comfortable for touch where mobile use is possible.

## Typography And Copy

- Keep headings proportional to their container. Reserve hero-scale type for actual hero sections.
- Do not scale font size directly with viewport width.
- Use normal letter spacing unless the existing system has a specific token.
- Keep in-app instructional copy minimal. The UI should show the workflow through controls and states.
- Use short, concrete labels for actions.
- Use typography as hierarchy, not decoration: page title, section title, table/header label, body text, metadata, and helper/error text should each have a clear role.

## AI Design Workflow

- Use text-to-UI style prompting for quick exploration when the concept is verbal and still fluid.
- Use sketch, screenshot, or image-guided design when layout structure already exists visually.
- Convert good design decisions into this file or page-specific notes so future UI work stays consistent.
- When a page needs a distinct visual treatment, create a short page override section instead of changing the global rules.
- Use fast text exploration for rough alternatives, then use image/screenshot-guided refinement when exact structure matters.
- Treat generated UI as a draft: manually review accessibility, responsive behavior, contrast, touch targets, and consistency before shipping.

## Token Direction

- Prefer a three-layer token model when introducing shared styling: primitive values, semantic aliases, then component-specific tokens.
- Keep Tailwind utility usage aligned with semantic intent. If a color or spacing choice repeats across features, promote it into a documented token or convention.
- Do not hardcode new visual values across many files without documenting the reason here.

## Pre-Delivery UI Check

- Text is readable and does not overflow in Arabic, English, and common long labels.
- Focus states are visible.
- Clickable controls have hover/active feedback and a stable size.
- Loading, empty, error, and success states are represented for core flows.
- Layout works at approximately 375px, 768px, 1024px, and 1440px widths when feasible.

## Page Overrides

Add page-specific deviations here when needed. If no override exists, follow the global rules above.

### Refund Execution

- Treat this page as an operations desk, not a dashboard showcase.
- Primary unit is the refund component, not the parent case.
- Use compact tables, clear filters, and restrained status badges.
- Keep bulk actions visible only when they apply to the selected rows.
- Use one blue action for external movement and one dark action for internal settlement.
- Avoid oversized cards, decorative gradients, and ambiguous labels like "hub" when an operator needs exact queue state.

### Enterprise Control

- Use a settings-console layout: persistent section navigation, focused forms, preview panels, and clear deployment state.
- Every automation rule should read like a sentence: trigger, condition, action, retry, escalation.
- Templates must show variables, preview, recipients, and last-sent evidence before deployment.
