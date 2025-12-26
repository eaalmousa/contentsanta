# Content Santa Design Guidelines

## Design Approach: Modern SaaS Productivity Platform

**Selected System:** Linear + Notion hybrid approach
- Linear's clean typography and sharp visual hierarchy
- Notion's friendly, functional component design
- Stripe's data clarity and form excellence

**Rationale:** Content Santa is a professional productivity tool requiring clear information hierarchy, efficient workflows, and data-dense interfaces. Users need to navigate complex content operations quickly while maintaining creative confidence.

---

## Typography System

**Font Stack:**
- Primary: Inter (Google Fonts) - body, UI elements
- Display: Space Grotesk (Google Fonts) - headings, emphasis

**Hierarchy:**
- Page Titles: text-4xl font-bold (Space Grotesk)
- Section Headers: text-2xl font-semibold
- Card/Panel Titles: text-lg font-semibold
- Body: text-base font-normal
- Metadata/Labels: text-sm font-medium
- Helper Text: text-xs

---

## Layout & Spacing System

**Tailwind Spacing Primitives:** 2, 4, 6, 8, 12, 16 units
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- Page margins: p-8 to p-12
- Card spacing: p-6
- Form field spacing: space-y-4

**Grid System:**
- Main content: max-w-7xl mx-auto
- Sidebar layouts: 280px fixed sidebar + flex-1 main
- Card grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

---

## Core Layout Structure

### Application Shell
- **Top Navigation Bar** (h-16, fixed)
  - Logo + workspace switcher (left)
  - Global search bar (center, max-w-md)
  - User menu + notifications (right)

- **Left Sidebar** (w-64, sticky)
  - Primary navigation sections
  - Workspace/brand selector at top
  - Collapsed state: w-20 (icons only)

- **Main Content Area**
  - Breadcrumb navigation (mb-6)
  - Page header with title + actions
  - Content cards/tables with consistent spacing

---

## Component Library

### Navigation Components

**Sidebar Navigation:**
- Section headers: text-xs uppercase tracking-wide font-semibold
- Nav items: py-2 px-3 rounded-lg
- Active state: font-semibold with subtle visual indicator
- Icons: 20px, left-aligned with 8px gap to text

**Breadcrumbs:**
- text-sm with chevron separators (Heroicons)
- Last item: font-semibold (current page)

### Content Cards

**Input/Asset Cards:**
- Border: 1px solid
- Rounded: rounded-lg
- Padding: p-6
- Shadow: minimal (shadow-sm)
- Header: flex justify-between items-start
- Body: space-y-4
- Footer: flex justify-between items-center with metadata badges

**Workflow Status Cards:**
- Compact version: p-4
- Status badge: top-right position
- Progress indicator when running
- Quick actions: bottom-right icon buttons

### Data Display

**Tables:**
- Header: sticky top-0, text-sm font-semibold uppercase
- Row height: h-16
- Cell padding: px-6 py-4
- Hover state on rows
- Checkbox column: w-12
- Action column: w-24, right-aligned

**Lists:**
- Divider between items
- Item padding: py-4
- Leading icon/avatar: w-10 h-10
- Title + metadata stacked layout

### Forms & Inputs

**Input Fields:**
- Height: h-10 for standard, h-12 for prominent
- Padding: px-4
- Border: 1px solid, rounded-md
- Focus ring: ring-2
- Label: text-sm font-medium mb-2
- Helper text: text-xs mt-1

**Textareas:**
- Min height: h-32
- Resize: vertical
- Same padding/border as inputs

**Select Dropdowns:**
- Custom styled with chevron icon
- Match input height and styling
- Dropdown panel: shadow-lg rounded-lg

**Button Hierarchy:**
- Primary CTA: px-6 py-2.5 rounded-lg font-semibold
- Secondary: border variant
- Tertiary: text-only with underline on hover
- Icon buttons: p-2 rounded-md

### Modal & Overlays

**Modals:**
- Backdrop: overlay with blur
- Panel: max-w-2xl rounded-xl shadow-2xl
- Header: p-6 border-b
- Body: p-6 max-h-[calc(100vh-200px)] overflow-y-auto
- Footer: p-6 border-t with action buttons

**Slide-over Panels:**
- Width: w-96 for narrow, w-[600px] for wide
- Full height: h-screen
- Close button: absolute top-4 right-4

### Workflow-Specific Components

**Workflow Runner Interface:**
- Split view: input (left) + output (right)
- Ratio: 40/60 or 50/50
- Settings panel: collapsible right sidebar (w-80)
- Progress bar: fixed top during processing

**Content Editor:**
- Toolbar: sticky top, rounded-lg border p-2
- Editor area: min-h-96 prose-lg max-w-none
- Version dropdown: top-right
- Comment sidebar: toggle-able, w-80

**Brand Voice Manager:**
- Two-column layout for rules
- Expandable sections with chevron icons
- Example cards showing before/after
- Tag input for terminology lists

---

## Dashboard & Analytics

**Dashboard Layout:**
- Stats row: grid-cols-4, each stat card with large number + label
- Chart sections: 2-column grid on desktop, stack on mobile
- Recent activity feed: max-h-96 overflow-y-auto

**Metric Cards:**
- Large number: text-3xl font-bold
- Label: text-sm
- Trend indicator: text-xs with icon
- Minimal decoration, focus on data

---

## Images

**Hero Image:** No traditional hero image
- Dashboard leads immediately with workspace selector and quick-start cards
- Marketing pages (if needed): Feature screenshot showcases instead of abstract hero imagery

**UI Screenshots:**
- Workflow result cards: 16:9 thumbnail previews
- Template library: Square thumbnails (1:1)
- Dashboard charts: Embedded within stat cards
- Help documentation: Inline annotated screenshots

**Placeholder Strategy:**
- Content previews: Subtle gradient rectangles
- Avatar fallbacks: Initials on solid background
- Empty states: Simple illustration + helpful text

---

## Responsive Behavior

**Breakpoints:**
- Mobile: < 768px (single column, stacked layouts)
- Tablet: 768-1024px (sidebar collapses to icons, 2-column grids)
- Desktop: > 1024px (full layout with sidebar expanded)

**Mobile Adaptations:**
- Bottom navigation replaces sidebar
- Tables convert to stacked cards
- Modals become full-screen
- Multi-column forms become single column

---

## Animation Principles

**Use Sparingly:**
- Page transitions: None or subtle fade
- Dropdown/modal entry: scale-95 to scale-100 (150ms)
- Loading states: Subtle pulse on skeleton screens
- Success confirmations: Brief scale pulse (200ms)