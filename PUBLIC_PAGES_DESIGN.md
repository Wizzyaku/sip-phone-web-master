# Phonicity — Public Pages & Global UI Design Specification

*This document focuses on the public-facing pages, shared components, responsive behavior, and design system so the UI/UX designer can begin producing high-fidelity designs immediately.*

---

## 1. Public Pages

### 1.1 Login Page

**URL**: `/login`
**Purpose**: Authenticate existing users.

#### Layout
- Full-screen centered layout with a subtle branded background.
- Left side (desktop): brand illustration / product value props / testimonials.
- Right side (desktop): login card.
- Mobile: single column, card centered vertically.

#### Sections / Elements
1. **Brand logo** (top-left or top-center)
2. **Page title**: "Welcome back"
3. **Subtitle**: "Sign in to your Phonicity account"
4. **Email input**:
   - Label: "Email"
   - Placeholder: "you@company.com"
   - Validation: required, valid email format
5. **Password input**:
   - Label: "Password"
   - Placeholder: "Enter your password"
   - Show/hide password toggle icon
   - Validation: required
6. **Remember me** checkbox + "Forgot password?" link on the same row
7. **Primary CTA button**: "Sign In"
8. **Divider**: "Or continue with"
9. **Social login buttons** (optional): Google, Microsoft
10. **Footer link**: "Don't have an account? Sign up"

#### States
- **Default**: all fields empty.
- **Loading**: button shows spinner, disabled.
- **Error**: inline error message below password field (e.g. "Invalid email or password").
- **Success**: redirect to `/dashboard`.

---

### 1.2 Signup Page

**URL**: `/signup`
**Purpose**: Create a new user account.

#### Layout
- Similar split-screen layout as login.
- Right side: multi-step or single-form signup card.

#### Sections / Elements
1. **Brand logo**
2. **Page title**: "Create your account"
3. **Subtitle**: "Start making and receiving calls in minutes"
4. **Full name input**:
   - Label: "Full name"
   - Placeholder: "John Doe"
   - Validation: required
5. **Email input**:
   - Label: "Email address"
   - Placeholder: "john@company.com"
   - Validation: required, valid email, unique
6. **Phone number input** (optional, for recovery):
   - Label: "Phone number (optional)"
   - Placeholder: "+1 (555) 123-4567"
7. **Password input**:
   - Label: "Password"
   - Placeholder: "Create a strong password"
   - Strength indicator bar below input (weak, fair, strong)
   - Show/hide toggle
   - Validation: min 8 chars, uppercase, number, symbol
8. **Confirm password input**:
   - Label: "Confirm password"
   - Validation: must match password
9. **Terms checkbox**:
   - "I agree to the Terms of Service and Privacy Policy"
10. **Primary CTA button**: "Create account"
11. **Divider + social login** (optional)
12. **Footer link**: "Already have an account? Sign in"

#### States
- **Default**
- **Validation errors**: shown per field
- **Loading**: spinner on button
- **Success**: message "Check your email to verify your account" or redirect to payment
- **Error**: "Something went wrong. Please try again."

---

### 1.3 Forgot Password Page

**URL**: `/forgot-password`
**Purpose**: Request a password reset link.

#### Layout
- Centered single card on a branded background.

#### Sections / Elements
1. **Brand logo**
2. **Page title**: "Reset your password"
3. **Subtitle**: "Enter your email and we'll send you a reset link"
4. **Email input**
5. **Primary CTA button**: "Send reset link"
6. **Back to login** link

#### States
- **Default**
- **Loading**: spinner
- **Success**: green message "If an account exists, a reset link has been sent."
- **Error**: red inline message

---

### 1.4 Payment Page

**URL**: `/payment`
**Purpose**: Collect payment after signup before account activation.

#### Layout
- Centered single card or two-column layout.
- Left: order summary; Right: payment form.

#### Sections / Elements
1. **Brand logo**
2. **Page title**: "Complete your setup"
3. **Order summary card**:
   - Plan name (e.g. "Business Phone Line")
   - Price (e.g. "$19.99 / month")
   - Included features list (checkmarks)
   - Total due today
4. **Payment method tabs**: Card, Bank Transfer, Mobile Money
5. **Card payment form**:
   - Cardholder name
   - Card number (with card icon detection)
   - Expiry date + CVC
   - Billing ZIP / postal code
   - Country dropdown
6. **Pay button**: "Pay $19.99"
7. **Security note**: "Payments are secure and encrypted"
8. **Support link**

#### States
- **Default**
- **Processing**: button disabled, spinner
- **Success**: "Payment successful. Your account is pending number assignment."
- **Error**: payment declined message with retry option

---

## 2. Global Components

### 2.1 Navigation / App Shell

#### Top navigation bar
- Height: 64px
- Elements (left to right):
  1. Hamburger menu toggle (mobile only)
  2. Brand logo
  3. Global search input (collapses to icon on mobile)
  4. Notification bell with unread badge
  5. Theme toggle (sun/moon icon)
  6. User avatar dropdown:
     - Profile
     - Settings
     - Admin dashboard (if admin)
     - Logout

#### Sidebar navigation
- Width: 240px (desktop)
- Items:
  - Dashboard
  - Calls
  - Messages (with unread badge)
  - Contacts
  - Settings
- Active item highlighted with primary color and subtle background.
- Bottom section: user mini profile.

#### Mobile navigation
- Bottom tab bar or slide-out drawer.
- Icons only with labels.

### 2.2 Cards

- Padding: 24px
- Border radius: 12px
- Shadow: subtle (0 1px 3px rgba)
- Header section: title + description + optional action button
- Content section: main content
- Footer section (optional): primary actions

### 2.3 Buttons

#### Primary button
- Solid primary color background
- White text
- Height: 40px (default), 48px (large)
- Border radius: 8px
- Hover: slightly darker shade
- Loading state: spinner icon, disabled

#### Secondary / Outline button
- Transparent background
- Primary color border and text
- Hover: primary color at 5–10% opacity fill

#### Destructive button
- Red background or red text
- Used for delete, hang up, reject call

#### Icon button
- Square button with centered icon
- Used for send, mute, speaker, backspace

### 2.4 Inputs

- Height: 40px
- Border radius: 8px
- Border: 1px neutral color
- Focus ring: 2px primary color
- Label above input
- Helper text below (optional)
- Error state: red border + error message

### 2.5 Tables

- Header row with column titles
- Alternating row backgrounds or subtle dividers
- Hover state on rows
- Action buttons at end of row
- Pagination footer
- Empty state row

### 2.6 Modals / Dialogs

- Centered overlay with backdrop blur
- Max width: 480px (default), 640px (large)
- Header: title + close button
- Body: form content or confirmation text
- Footer: action buttons (cancel + confirm)

### 2.7 Toast Notifications

- Position: top-right on desktop, top-center on mobile
- Types: success (green), error (red), warning (amber), info (blue)
- Auto-dismiss after 4 seconds
- Close button
- Slide-in / fade-out animation

### 2.8 Badges

- Small rounded pills
- Types: default, primary, success, warning, destructive
- Used for status indicators (Active, Pending, Suspended)

### 2.9 Avatars

- Circular user initials or uploaded image
- Sizes: sm (32px), md (40px), lg (64px)
- Optional online status indicator dot

### 2.10 Empty States

- Centered illustration or icon
- Title: friendly message
- Description: what the user can do next
- Optional CTA button

Examples:
- "No messages yet" + "Start a conversation"
- "No calls yet" + "Make your first call"
- "No assigned number" + "Contact admin"

---

## 3. Responsive Behavior

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px – 1023px
- **Desktop**: ≥ 1024px

### Global responsive rules

#### App shell
- Desktop: sidebar fixed on left, main content area to the right.
- Tablet: sidebar collapses to icon-only width.
- Mobile: sidebar hidden; bottom tab navigation or hamburger drawer.

#### Public pages
- Desktop: split-screen (branding left, form right).
- Tablet: reduced illustration size, narrower form.
- Mobile: illustration hidden, single-column centered form.

#### Messages page
- Desktop: two-column layout (conversation list 35%, chat area 65%).
- Tablet: conversation list 40%, chat 60%.
- Mobile: show either conversation list or chat, not both.

#### Calls page
- Desktop: registration panel left, dial pad right.
- Mobile: stacked vertically.

#### Admin tables
- Desktop: full table with all columns.
- Tablet: hide less important columns (created date, role).
- Mobile: cards instead of table rows.

---

## 4. Design System Suggestions

### 4.1 Color Palette

#### Primary
- Primary 50: #eff6ff
- Primary 100: #dbeafe
- Primary 200: #bfdbfe
- Primary 300: #93c5fd
- Primary 400: #60a5fa
- Primary 500: #3b82f6
- Primary 600: #2563eb
- Primary 700: #1d4ed8
- Primary 800: #1e40af
- Primary 900: #1e3a8a

#### Semantic colors
- Success: #22c55e
- Warning: #f59e0b
- Error: #ef4444
- Info: #3b82f6

#### Neutral colors
- Background: #ffffff (light), #0f172a (dark)
- Surface: #f8fafc (light), #1e293b (dark)
- Border: #e2e8f0 (light), #334155 (dark)
- Text primary: #0f172a (light), #f8fafc (dark)
- Text secondary: #64748b (light), #94a3b8 (dark)

### 4.2 Typography

- **Font family**: Inter, Geist, or system sans-serif
- **Page title**: 24–30px, font-weight 700
- **Section title**: 18–20px, font-weight 600
- **Body**: 14–16px, font-weight 400
- **Caption / helper**: 12–13px, font-weight 400
- **Button text**: 14px, font-weight 500

### 4.3 Spacing

- Base unit: 4px
- Common values: 4, 8, 12, 16, 24, 32, 48, 64px
- Card padding: 24px
- Section gap: 24–32px
- Input gap: 16px

### 4.4 Border Radius

- Inputs / buttons: 8px
- Cards / modals: 12px
- Avatars: 50% (full circle)
- Badges / pills: 9999px

### 4.5 Shadows

- Card shadow: 0 1px 3px rgba(0,0,0,0.08)
- Modal shadow: 0 10px 25px rgba(0,0,0,0.12)
- Button shadow (optional): 0 2px 4px rgba(0,0,0,0.05)

### 4.6 Icons

- Use **Lucide** icon library.
- Common icons:
  - Dashboard: `LayoutDashboard`
  - Calls: `Phone`
  - Messages: `MessageSquare`
  - Contacts: `Users`
  - Settings: `Settings`
  - Notifications: `Bell`
  - Send: `Send`
  - Mute: `Mic`, `MicOff`
  - Speaker: `Volume2`, `VolumeX`
  - Theme: `Sun`, `Moon`
  - Menu: `Menu`

### 4.7 Motion & Animation

- Page transitions: fade-in, 200ms ease-out
- Button hover: 150ms color/scale transition
- Modal: scale-up + backdrop fade, 200ms
- Toast: slide-in from right, fade-out
- Loading: spinner rotation, skeleton pulse

### 4.8 Accessibility

- Minimum contrast ratio 4.5:1 for text
- Focus rings visible on all interactive elements
- ARIA labels on icon-only buttons
- Keyboard-navigable modals and forms
- Screen reader friendly error messages

---

## 5. Assets the Designer Should Prepare

### Brand assets
- Logo (light and dark variants, SVG)
- App icon / favicon
- Brand pattern or subtle background texture

### Illustrations
- Login/signup hero illustration
- Payment success illustration
- Empty state illustrations for:
  - No messages
  - No calls
  - No contacts
  - No notifications
  - No assigned number
  - Pending approval

### Marketing copy
- Login page tagline
- Signup value propositions
- Payment plan benefits

---

*The UI/UX designer can now start with these public pages and global components. Once approved, we will move to the user dashboard and admin dashboard pages.*
