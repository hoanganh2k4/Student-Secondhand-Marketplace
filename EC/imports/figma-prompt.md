# Figma Design Prompt — Student Secondhand Marketplace

> Paste each section below directly into Figma AI (or hand to a UI designer as a brief).
> Sections are ordered: Design System first, then screens in user-flow order.

---

## MASTER PROMPT (paste this first to set context)

Design a mobile-first web application for a **university student secondhand marketplace** called **"UniSwap"** (placeholder name). The platform is NOT a generic listing site — it is a **demand-driven, proof-based, structured transaction platform** where buyers post what they want, the system matches them with sellers, and both sides go through a guided verification and negotiation flow before a deal is made.

**Target user:** University students aged 18–25. They are comfortable with mobile apps, expect a clean experience similar to Carousell or Vinted, but with more structure and guidance built into the flow.

**Tone:** Trustworthy, clean, campus-friendly. Not corporate. Not dark. Feels like a product made by students, for students.

**Device:** Design all screens at **390×844px** (iPhone 14 Pro base). Provide desktop breakpoint (1280px wide) for the Conversation and Admin screens only.

**Design system reference:** Inspired by Linear's information density, Carousell's card-based listings, and Notion's calm neutral palette. Clean, not flashy.

---

## SECTION 1 — DESIGN SYSTEM

### Color Palette

```
Primary:       #2563EB   (Blue 600 — CTAs, active states, links)
Primary Light: #EFF6FF   (Blue 50 — highlighted backgrounds)
Success:       #16A34A   (Green 600 — completed, verified)
Warning:       #D97706   (Amber 600 — pending, waiting)
Danger:        #DC2626   (Red 600 — errors, disputes, rejected)
Neutral 900:   #111827   (Primary text)
Neutral 600:   #4B5563   (Secondary text, labels)
Neutral 300:   #D1D5DB   (Borders, dividers)
Neutral 100:   #F3F4F6   (Card backgrounds, surface)
White:         #FFFFFF   (Page background)
```

### Typography

```
Font family: Inter (all weights)

Display:    28px / Bold    / Neutral 900   — page titles
Heading:    20px / SemiBold / Neutral 900  — section headings
Subheading: 16px / SemiBold / Neutral 900  — card titles
Body:       15px / Regular / Neutral 900   — main content
Caption:    13px / Regular / Neutral 600   — metadata, timestamps
Label:      12px / Medium  / Neutral 600   — input labels, tags
Micro:      11px / Regular / Neutral 600   — badges, chips
```

### Component Library (build these first)

**Buttons:**
- Primary: Blue 600 fill, white text, 8px radius, 44px height
- Secondary: White fill, Blue 600 border, Blue 600 text
- Destructive: Red 600 fill, white text
- Ghost: No fill, no border, Blue 600 text
- Disabled: Neutral 300 fill, Neutral 600 text
- All buttons: 16px horizontal padding, full-width variant for mobile

**Input Fields:**
- Height: 48px
- Border: 1px Neutral 300, 8px radius
- Focus state: 2px Blue 600 border
- Error state: 2px Red 600 border + error message below
- Label: 12px Medium, Neutral 600, 8px above input
- Helper text: 12px Regular, Neutral 600, 4px below input

**Cards:**
- Background: White
- Border: 1px Neutral 300
- Border radius: 12px
- Shadow: 0 1px 3px rgba(0,0,0,0.08)
- Padding: 16px

**Status Badges (pill shape, 6px radius):**
- Active / Verified:     Green 600 bg 10% opacity + Green 600 text
- Pending / Waiting:     Amber 600 bg 10% opacity + Amber 600 text
- Draft / Inactive:      Neutral 300 bg + Neutral 600 text
- Matched:               Blue 600 bg 10% opacity + Blue 600 text
- Closed / Expired:      Neutral 100 bg + Neutral 600 text
- Rejected / Cancelled:  Red 600 bg 10% opacity + Red 600 text

**Match Score Indicator:**
- A horizontal pill showing the score (e.g., "87 / 100")
- Color: Green if ≥ 80, Amber if 60–79, Neutral if 40–59
- Accompanied by a small confidence label: "High match", "Medium match", "Possible match"

**Stage Progress Bar:**
- 3-step horizontal stepper
- Steps: Verification → Clarification → Negotiation
- Active step: Blue 600 filled circle with white number
- Completed step: Green 600 checkmark circle
- Inactive step: Neutral 300 circle

**Trust Tier Badge:**
- "New": Neutral chip
- "Established": Blue chip with shield icon
- "Trusted": Green chip with verified checkmark icon

**Bottom Navigation Bar (mobile):**
- 5 tabs: Home / Demands / Listings / Conversations / Profile
- Active tab: Blue 600 icon + Blue 600 label
- Inactive tab: Neutral 600 icon + Neutral 600 label
- Height: 64px + safe area
- Background: White, top border 1px Neutral 300

---

## SECTION 2 — AUTHENTICATION SCREENS

### Screen 2A — Login / Sign Up

**Layout:** Centered single-column, vertically centered on page.

**Elements (top to bottom):**
1. App logo mark (abstract "U" or two overlapping circles suggesting exchange) — 48×48px
2. App name "UniSwap" — Display size, Neutral 900
3. Tagline: "The marketplace built for your campus." — Body, Neutral 600
4. Divider with 24px gap
5. Email input field — label: "University Email", placeholder: "yourname@university.edu"
6. Primary button full-width: "Continue with Email"
7. Caption below: "We'll send you a magic link. No password needed."
8. Divider line with "or" text
9. Ghost text link: "Learn how it works →"

**Validation state:** If email domain is not from an allowed university, show inline error below the input: "Only verified university emails are accepted. Check your institution's email." — Red 600 text, 13px.

**Note:** No password field. Magic link auth only.

---

### Screen 2B — Magic Link Sent

**Layout:** Centered, calm confirmation screen.

**Elements:**
1. Large email envelope icon — 64px, Blue 600
2. Heading: "Check your inbox"
3. Body: "We sent a sign-in link to **yourname@university.edu**. Click the link to access your account."
4. Caption: "Link expires in 10 minutes. Check your spam folder if you don't see it."
5. Ghost button: "Resend link" (appears after 60 seconds, grayed before)
6. Ghost button: "Use a different email"

---

### Screen 2C — First-Time Onboarding (after email verified)

**Layout:** Single screen, 3 quick fields, no scroll needed.

**Heading:** "Almost there — tell us a bit about yourself"
**Subheading:** "This information stays on your profile and helps build trust."

**Fields:**
1. Full name input
2. Graduation year — select dropdown (current year + 4 years forward)
3. Primary campus location — select dropdown (admin-configured campus zones)

**Below fields:** CTA button "Set up my account →"

**Bottom note:** Small lock icon + "Your student status is verified via your email domain."

---

## SECTION 3 — HOME / DASHBOARD

### Screen 3A — Home Dashboard

**Top bar:**
- Left: App logo (small, 24px)
- Right: Bell icon (notification count badge if unread > 0), then Avatar circle

**Hero greeting (16px top padding):**
- "Good morning, [Name] 👋" — Heading
- "You have 2 new matches and 1 pending evidence request." — Body, Neutral 600

**Section: "Your Active Demands" (horizontal scroll cards)**
- Section title + "See all" link (right aligned)
- Each card (220×120px, compact):
  - Category chip (top left)
  - Item title — Subheading, 2 lines max
  - Budget range — Caption, Neutral 600
  - Status badge — bottom left
  - Match count badge — "3 matches" — Blue chip, bottom right

**Section: "Recent Matches" (vertical list)**
- Section title + "See all" link
- Each row (Match List Item):
  - Left: Product thumbnail 56×56px, 8px radius
  - Center: Product title (1 line), demand it matched with (Caption, Neutral 600), match score pill
  - Right: Chevron icon + timestamp

**Section: "Your Listings" (horizontal scroll cards)**
- Same structure as demands section
- Shows status badge (active / partially sold / sold)

**Empty state (if no activity):**
- Illustration: two hands exchanging an item (simple line art)
- Heading: "Nothing here yet"
- Body: "Post what you're looking for, or list something to sell."
- Two buttons side by side: "Post a Demand" (Primary), "Create a Listing" (Secondary)

---

## SECTION 4 — DEMAND REQUEST SCREENS

### Screen 4A — Create Demand (Step 1 of 3: What do you need?)

**Top bar:** Back chevron, "New Demand Request", step indicator "1 of 3"

**Form fields:**
1. **Category** — Large tappable category grid (2 columns, 5 rows = 10 categories)
   - Each cell: category icon (32px) + label below
   - Selected: Blue 600 border + Blue 600 bg 10%
   - Categories: Textbooks, Electronics, Furniture, Clothing, Appliances, Sports Gear, Musical Instruments, Gaming, Stationery, Other
2. **Subcategory** — Appears after category selected; horizontal chip scroll (e.g., under Electronics: Laptop, Phone, Tablet, Headphones)
3. **What exactly do you need?** — Text area, placeholder: "Describe the specific item. E.g. 'Calculus: Early Transcendentals 8th edition by James Stewart'"
4. **Special requirements** — Text input, placeholder: "E.g. Must include original box, charger, etc." (optional)

**Bottom sticky:** Primary button "Next →"

---

### Screen 4B — Create Demand (Step 2 of 3: Budget & Condition)

**Top bar:** Back chevron, "New Demand Request", step indicator "2 of 3"

**Form fields:**
1. **Budget range** — Two numeric inputs side by side:
   - Left: "Min ($)"
   - Right: "Max ($)"
   - Below: A horizontal range slider that adjusts both values visually
2. **Preferred condition** — Segmented control (4 options):
   - "Any" / "Good" / "Very Good" / "Like New"
   - Selected segment: Blue 600 fill, white text
3. **Quantity needed** — Stepper control (minus button / number / plus button), default 1
4. **Urgency** — Radio group with descriptions:
   - "Flexible — Anytime in the next 30 days"
   - "Within a week — I need this soon"
   - "Within a month — No rush but prefer sooner"

**Bottom sticky:** Primary button "Next →"

---

### Screen 4C — Create Demand (Step 3 of 3: Location & Review)

**Top bar:** Back chevron, "New Demand Request", step indicator "3 of 3"

**Form fields:**
1. **Preferred pickup location** — Select dropdown of campus zones

**Review summary card (read-only, rounded card):**
- Row: Category → chip
- Row: Item description → body text
- Row: Budget → "$X – $Y"
- Row: Condition → chip
- Row: Quantity → number
- Row: Urgency → label
- Row: Location → label
- Small "Edit" ghost button in top-right of card

**Bottom sticky:**
- Primary button "Post Demand Request"
- Caption below button: "Your demand expires in 30 days. You can cancel anytime."

---

### Screen 4D — Demand Detail

**Top bar:** Back, "Demand Request", 3-dot menu (Edit / Cancel)

**Content:**
1. Status badge (large, prominent) — e.g., "Matched · 3 matches found"
2. Category chip + Item title (Heading)
3. Budget range — Body, Neutral 600
4. Condition / Quantity / Location / Urgency — 2-column info grid (label + value pairs)
5. Special requirements — if present, collapsible section

**Section: "Your Matches" (vertical list)**
- Each Match row:
  - Left: Product photo thumbnail 56×56px
  - Center: Product title, Seller name + Trust Tier badge, match score pill
  - Right: "View" button (small, secondary) + confidence label below ("High match")
- If no matches yet: Amber info banner "We're looking for matching listings. You'll be notified when we find one."

---

## SECTION 5 — PRODUCT LISTING SCREENS

### Screen 5A — Create Listing (Step 1 of 3: Item Details)

**Top bar:** Back, "New Listing", step indicator "1 of 3"

**Form fields:**
1. **Title** — Text input, placeholder: "e.g. MacBook Air 2020 M1 Space Gray"
2. **Category + Subcategory** — Same grid pattern as Demand creation
3. **Condition** — 5-option segmented scroll (Poor / Fair / Good / Very Good / Like New)
   - Below selector: A description card appears for the selected condition:
     - Like New: "No visible wear. Looks and functions like brand new."
     - Very Good: "Light signs of use. Fully functional."
     - Good: "Normal wear. All features work."
     - Fair: "Noticeable wear or minor defects. Functional."
     - Poor: "Heavy wear or significant defects. May have issues."
4. **Condition notes** — Text area, placeholder: "Describe any specific scratches, damage, or missing parts. Buyers will see this."
5. **Description** — Text area (optional but recommended)

**Bottom sticky:** Primary button "Next →"

---

### Screen 5B — Create Listing (Step 2 of 3: Photos & Proof)

**Top bar:** Back, "New Listing", step indicator "2 of 3"

**Heading:** "Add proof photos"
**Subheading:** "At least 2 photos are required. Clear, well-lit photos get matched faster."

**Category-specific requirements banner (Blue info card):**
- Icon: camera
- Text: "For Electronics: include a photo of the device powered on, the serial number, and any damage."

**Photo upload grid (3 columns):**
- First 2 cells: dashed border, camera icon, "Required" label
- Remaining cells: dashed border, camera icon, "Optional"
- After upload: thumbnail fills cell; top-right shows a red "×" remove button
- Bottom of each uploaded cell: quality score mini-bar (green = good, red = poor)

**Proof completeness meter:**
- A horizontal progress bar below the grid
- Label: "Proof completeness: 65%" — updates live as photos are added
- Below bar: "Add 1 more photo to unlock publishing"

**Bottom sticky:** Primary button "Next →" (disabled until ≥ 2 photos uploaded and completeness ≥ 50%)

---

### Screen 5C — Create Listing (Step 3 of 3: Price & Logistics)

**Top bar:** Back, "New Listing", step indicator "3 of 3"

**Form fields:**
1. **Asking price** — Large currency input, centered, "$" prefix
2. **Open to offers?** — Toggle switch, label: "Buyers can negotiate price"
3. **Quantity available** — Stepper
4. **Location** — Campus zone selector
5. **Availability window** — Text input, placeholder: "e.g. Weekday evenings, anytime on weekends"

**Bottom sticky:**
- Primary button "Publish Listing"
- Caption: "Listing expires in 30 days."

---

### Screen 5D — Listing Detail (Seller's View)

**Top bar:** Back, "My Listing", 3-dot menu (Edit / Remove)

**Content:**
1. Photo carousel (full-width, 16:9, with dot pagination)
2. Status badge (large)
3. Title (Heading) + Condition chip
4. Price (large, 24px bold, Blue 600)
5. Quantity remaining — "3 of 5 available" — Caption
6. Description — collapsible if long
7. Location + Availability — icon + text rows

**Section: "Matched Demands" (vertical list)**
- Each row:
  - Left: Buyer avatar (initials circle)
  - Center: Demand title, Budget range (Caption), match score pill
  - Right: "View" button + confidence label

---

## SECTION 6 — MATCH SCREENS

### Screen 6A — Match Detail

**Top bar:** Back, "Match Found"

**Match score hero (prominent card, centered):**
- Large score number (40px bold) — colored by confidence
- Label: "High Match" / "Medium Match" / "Possible Match"
- 5 mini score bars below (one per dimension):
  - Category · Price · Condition · Location · Quantity
  - Each bar: label left, percentage right, colored bar fill

**If missing info flags exist — Amber warning card:**
- Icon: warning triangle
- Text: "Price may be slightly above budget." / "Only partial quantity available."

**Two-column side-by-side summary:**
| Buyer's Demand | Seller's Listing |
|---------------|-----------------|
| Category chip | Category chip |
| Budget $X–$Y | Price $Z |
| Condition needed | Condition of item |
| Quantity needed | Quantity available |
| Location | Location |

**Action bar (2 buttons):**
- Left: "Not interested" (Ghost, Danger text)
- Right: "Start Conversation" (Primary) — or "Accept Match" if high confidence auto-accept flow

---

## SECTION 7 — CONVERSATION SCREENS

### Screen 7A — Conversation List (Inbox)

**Top bar:** "Conversations", filter chips: All / Active / Awaiting You

**Each conversation row:**
- Left: Product photo thumbnail 48×48px, 8px radius
  - Overlapping bottom-right: Stage badge dot (Blue = verification, Amber = clarification, Green = negotiation)
- Center:
  - Line 1: Counterparty name + Trust Tier badge
  - Line 2: Product title (Caption, Neutral 600)
  - Line 3: Last message preview (Caption, Neutral 600, italic)
- Right:
  - Timestamp (Caption)
  - Unread count badge (Blue 600 filled circle) if unread > 0

**Awaiting your action banner (if any):**
- Amber banner at top: "You have 2 conversations waiting for your response."

---

### Screen 7B — Conversation Thread (Verification Stage)

**Top bar:** Back, counterparty name + avatar, 3-dot menu (Report / Close)

**Stage Progress Bar** (below top bar, 3 steps, Step 1 active)

**System message (opening, auto-generated, styled differently from chat bubbles):**
- Blue 600 left border card
- Text: "Match found. [Buyer] is interested in your [Product]. Review the proof below before chatting."
- Match score chip inline

**Proof Gallery section:**
- Heading: "Seller's Proof"
- Horizontal scroll of photo thumbnails (100×100px), tap to fullscreen lightbox

**Evidence Requests section:**
- Heading: "Evidence Requests"
- Each EvidenceRequest card:
  - Request type icon (camera / video / document)
  - Description text
  - Status badge (Pending / Fulfilled / Rejected / Expired)
  - If fulfilled: "View proof →" link
  - If pending + seller viewing: "Fulfill Request" primary button
  - Due date caption: "Due in 18 hours"

**Stage action (buyer view only):**
- Sticky bottom bar: Green button "I'm satisfied with the proof →" (advances to clarification)
- Below: Blue ghost button "Request more evidence" (disabled if 5 requests already)

**Note:** No free-form message input in this stage. Messages area shows only system messages.

---

### Screen 7C — Conversation Thread (Clarification Stage)

**Same top bar + Stage Progress Bar** (Step 2 active)

**System transition message:**
"Proof review complete. You can now ask questions directly."

**Chat thread (scrollable):**
- Sender's messages: right-aligned, Blue 600 bg, white text, 12px radius (flat on sender's side)
- Receiver's messages: left-aligned, Neutral 100 bg, Neutral 900 text
- System messages: centered, Neutral 600 text, italic, smaller font
- Each message: sender name (Caption) + timestamp below bubble

**Input bar (bottom, sticky):**
- Text input field with placeholder: "Ask a question..."
- Attach icon (left of input) — opens ProofAsset picker
- Send button (right, Blue 600 arrow icon)
- Rate limit warning: "9 messages remaining this hour" — shown as Caption above input when limit approaching

**Stage action:**
- Floating pill button: "Ready to make an offer →" (Blue 600, appears after any message is sent)

---

### Screen 7D — Conversation Thread (Negotiation Stage)

**Same structure as Clarification stage** but with one key addition:

**Active Offer Card (appears above input bar when offer exists):**
- Card with Blue 600 left border
- "Offer from [Name]" — Subheading
- Quantity · Price · Total — 3-column info row
- Meetup: location + date/time
- Status badge: Pending
- Two buttons: "Accept" (Primary, Green) / "Counter" (Secondary) / "Reject" (Ghost, Red)
- Expiry: "Expires in 36 hours"

**No active offer — "Create Offer" button:**
- Floating action button above input: "Make an Offer +" (Blue 600)

---

### Screen 7E — Evidence Request (Create, Buyer)

**Bottom sheet modal (slides up from bottom)**

**Heading:** "Request more evidence"

**Fields:**
1. **What do you need?** — Radio group with icons:
   - 📷 Additional photo
   - 🎥 Video clip
   - 📏 Measurement / dimension
   - 📄 Document (receipt, warranty)
   - 🎬 Live demo video
2. **Describe what you want to see** — Text area, placeholder: "E.g. Please show the battery health screen in Settings > Battery"

**Footer:**
- Caption: "Seller has 48 hours to respond. You have X requests remaining."
- Primary button: "Send Request"

---

## SECTION 8 — OFFER SCREENS

### Screen 8A — Create Offer (bottom sheet, full height)

**Heading:** "Create an Offer"
**Caption:** "Fill in the terms. The other party can accept, counter, or reject."

**Fields:**
1. **Quantity** — Stepper (pre-filled from match)
2. **Price per unit ($)** — Large numeric input
3. **Total** — Auto-calculated, shown as read-only: "Total: $XXX" (large, Blue 600, updates live)
4. **How will you hand it over?** — Segmented: Pickup / Delivery / Flexible
5. **Meetup location** — Text input (if Pickup or Flexible)
6. **Proposed date & time** — Date + time picker
7. **Additional terms** — Text area (optional)

**Proof snapshot note (info card):**
- Lock icon + "The proof photos seen during this conversation will be saved with this offer."

**Footer:**
- Primary button "Send Offer"
- Caption: "Offer expires in 48 hours."

---

### Screen 8B — Offer Detail (received, full screen)

**Top bar:** "Offer Received"

**Offer summary card:**
- Header: from photo + name + "sent you an offer"
- Grid of terms:
  - Quantity / Unit Price / **Total Price** (large, Green 600)
  - Fulfillment method / Location / Date & Time
- Terms notes (if present)
- Proof snapshot section: "Agreed proof at time of offer" — thumbnail strip, tap to view

**Expiry countdown:**
- Amber inline: "⏱ This offer expires in 36 hours"

**Action buttons (3 stacked):**
1. Primary Green: "Accept Offer" — confirm dialog before action
2. Secondary: "Counter Offer" — opens Create Offer sheet with pre-filled values
3. Ghost Red: "Reject Offer"

---

## SECTION 9 — ORDER SCREENS

### Screen 9A — Order Created (confirmation screen)

**Full-screen success state:**
1. Green checkmark animation (Lottie or CSS)
2. Heading: "Deal agreed! 🎉"
3. Body: "Your order has been created. Arrange the meetup and confirm when done."
4. Order summary card:
   - Item name + photo
   - Agreed price (large, Green 600)
   - Meetup: location + date/time
   - Counterparty: name + avatar + rating
5. Two buttons: "View Order Details" (Primary) / "Message [Name]" (Secondary)

---

### Screen 9B — Order Detail

**Top bar:** Back, "Order #1234", status badge

**Status timeline (vertical stepper):**
- Order Created ✓ (timestamp)
- Deal Confirmed ✓ / ⏳
- Meetup ⏳ (shows agreed date/time)
- Completed ⏳ / 🔴 Disputed

**Order snapshot card:**
- Product photo (full-width, 200px height)
- Title, Condition, Quantity
- Final Price (large)
- Fulfillment + Meetup details
- Counterparty info (name + trust tier + rating)

**Proof snapshot (collapsible):**
- "View agreed proof photos" — expands thumbnail strip

**Action section (context-aware):**
- If in_progress: Green button "Confirm Meetup Happened" + Gray button "Something went wrong"
- If completed: "Leave a Review" button
- If disputed: "View Dispute" button

---

### Screen 9C — Leave Review (bottom sheet)

**Heading:** "How was the experience?"
**Subheading:** "[Name]'s rating will be updated."

**Star rating:** Large 5-star tap selector (each star 40px)

**Comment field:** Text area, placeholder: "Optional. Be honest and fair."

**Info note:** "Reviews are published after both sides have reviewed."

**Footer:** Primary button "Submit Review"

---

## SECTION 10 — PROFILE SCREEN

### Screen 10A — My Profile

**Top section:**
- Avatar (64px circle, initials or photo)
- Name (Heading)
- University + Graduation Year (Caption, Neutral 600)
- Trust Tier Badge (large)
- Star rating (e.g., ⭐ 4.8 · 12 reviews)
- "Edit Profile" ghost button (right)

**Stats row (3 columns):**
- Orders Completed / Listings Active / Demands Active

**Section: "My Listings"**
- Compact horizontal scroll of listing cards
- "See All" link

**Section: "My Demands"**
- Same pattern

**Section: "Reviews Received"**
- Vertical list of review items:
  - Left: Reviewer avatar
  - Center: Stars + comment + item name
  - Right: Date

---

## SECTION 11 — ADMIN SCREENS (desktop, 1280px)

### Screen 11A — Admin Dashboard

**Left sidebar (240px):**
- App logo
- Navigation: Overview / Users / Listings / Demands / Matches / Disputes / Categories
- Active item: Blue 600 bg (10% opacity) + Blue 600 text
- Bottom: current admin avatar + name + "Sign out"

**Main content — Overview:**
- Stats cards row (4): Active Users / Active Listings / Active Demands / Open Disputes
- Recent flags table: ProofAsset ID / Listing / Reason / Reports count / Action buttons
- Recent disputes table: Order ID / Buyer / Seller / Type / Status / Assign button

---

### Screen 11B — Dispute Resolution

**Top bar:** "Dispute #789" + status badge + "Assign to Me" button

**Two-column layout:**

Left column (60%):
- Dispute type chip + description
- Filed by: [User info]
- Order snapshot: item, price, meetup details, date
- Evidence submitted by filer: photo gallery
- Timeline of events: vertical timeline of Order + Conversation events leading to dispute

Right column (40%):
- Conversation history (read-only, condensed view)
- Proof assets from original listing (gallery)
- Resolution form:
  - Radio: Resolved for Buyer / Resolved for Seller / Mutual / Dismissed
  - Text area: Resolution notes
  - Primary button: "Submit Resolution"
- Contact both parties button (ghost)

---

## SECTION 12 — EMPTY STATES AND EDGE CASE SCREENS

**Design one screen for each empty state:**

1. **No matches yet (Demand is waiting):**
   - Illustration: magnifying glass over empty area
   - "We're looking for matching listings"
   - "You'll get notified as soon as we find something. Try widening your budget."
   - Button: "Edit Demand"

2. **Conversation auto-closed (inactivity):**
   - Grey lock icon
   - "This conversation has closed due to inactivity"
   - "The listing is still available. Start fresh if you're still interested."
   - Button: "View Listing"

3. **Offer expired:**
   - Clock icon (Neutral 600)
   - "This offer has expired"
   - "You can create a new offer if you're still interested."
   - Button: "Make New Offer"

4. **No internet / error state:**
   - Offline illustration
   - "Can't connect right now"
   - Retry button

5. **Listing removed by admin:**
   - Warning triangle
   - "This listing was removed by our moderation team"
   - Contact support link

---

## SECTION 13 — NOTIFICATION SCREENS

### Screen 13A — Notification Center

**Top bar:** "Notifications", "Mark all read" ghost button

**Grouped by Today / Yesterday / Earlier:**

Each notification row:
- Left: Icon (color-coded by type: Blue = match, Amber = evidence, Green = order, Red = dispute)
- Center:
  - Bold title line: "New match for your MacBook demand"
  - Body: "A seller listed a MacBook Air 2020 (87/100 match score)"
  - Timestamp (Caption)
- Right: Blue dot if unread
- Tap: navigates to the relevant screen

**Notification types to design:**
- New match found (high confidence)
- Evidence request received
- Evidence request fulfilled
- Offer received
- Offer accepted
- Offer rejected / expired
- Order created
- Completion confirmation prompt
- Conversation closing soon (inactivity warning)
- Dispute status update

---

## FINAL DESIGN NOTES FOR FIGMA

1. **Create a Component page first.** Build the design system components (buttons, inputs, badges, cards) before any screen. Use auto-layout throughout.

2. **Use variables for colors and typography.** Define all colors in the Figma variable panel so dark mode can be added later without rework.

3. **Every screen must have 3 states:**
   - Default
   - Loading (skeleton screens, not spinners)
   - Empty state

4. **Skeleton loading pattern:** Use gray shimmer rectangles matching the shape of the content that will load. Apply to: Conversation list, Match list, Proof gallery.

5. **Prototype connections to build:**
   - Login → Onboarding → Dashboard
   - Dashboard → Create Demand (3 steps) → Demand Detail
   - Dashboard → Create Listing (3 steps) → Listing Detail
   - Match Detail → Conversation (Verification → Clarification → Negotiation)
   - Negotiation → Create Offer → Offer Detail → Order Created
   - Order → Leave Review

6. **Accessibility minimums:**
   - All text contrast ≥ 4.5:1 against background
   - Tap targets ≥ 44×44px
   - Error states communicate with text, not color alone

7. **Frame naming convention:**
   ```
   [Section]-[Screen Letter]-[State]
   Examples:
     AUTH-2A-Default
     AUTH-2A-Error
     CONV-7B-Verification-BuyerView
     CONV-7B-Verification-SellerView
   ```
