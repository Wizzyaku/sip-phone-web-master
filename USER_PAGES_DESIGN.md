# Phonicity — User Dashboard Pages Design Specification

*This document details the design of every user dashboard page so the UI/UX designer can produce high-fidelity designs without ambiguity.*

---

## 1. Dashboard (Home)

**URL**: `/dashboard`
**Purpose**: Give the user a quick overview of their account and activity, plus shortcuts to the most common actions.

### Layout
- Top: page title + current date.
- Main grid:
  - Top row: 4 stat cards.
  - Middle row: assigned number card + quick actions.
  - Bottom row: recent activity list.

### Sections / Elements

#### 1.1 Welcome header
- Title: "Good morning, [Name]"
- Subtitle: "Here's what's happening with your Phonicity line."

#### 1.2 Stats cards (4 columns on desktop, 2 on tablet, 1 on mobile)
Each card has:
- Icon (top-left)
- Label (e.g. "Calls today")
- Value (e.g. "12")
- Change indicator (optional, e.g. "+2 vs yesterday")

Cards:
1. **Calls today** — `Phone` icon
2. **Messages today** — `MessageSquare` icon
3. **Unread messages** — `Bell` icon with badge
4. **Account status** — `Shield` icon (Active / Pending / Suspended)

#### 1.3 Assigned number card
- Large display of the user's assigned phone number (e.g. +1 423 730 3370)
- Label: "Your Phonicity number"
- Status badge: "Active" or "Pending assignment"
- Buttons:
  - "Start a call" (links to Calls)
  - "Send a message" (links to Messages)

#### 1.4 Quick actions card
- Title: "Quick actions"
- 4 buttons in a 2x2 grid or row:
  - New call
  - New message
  - Add contact
  - View settings

#### 1.5 Recent activity feed
- Title: "Recent activity"
- List of last 5–7 items (calls + messages mixed)
- Each item shows:
  - Type icon (phone or message)
  - Contact name or number
  - Direction label (incoming / outgoing)
  - Timestamp
- "View all" link to Calls or Messages

### Empty states
- If no activity yet: "No activity yet. Start your first call or message."
- If no assigned number: "Your number is being prepared. You'll be notified soon."

### Notes for designer
- This is the user's first impression after login. Keep it clean and scannable.
- The assigned number should be the most visually prominent element.

---

## 2. Calls (SIP Softphone)

**URL**: `/calls`
**Purpose**: Allow the user to make and receive voice calls through their browser.

### Layout
- Desktop: 2-column grid (registration panel left, dial pad right).
- Mobile: stacked vertically, active call card at top.

### Sections / Elements

#### 2.1 Active call card (only visible during a call)
- Large phone icon or contact avatar
- Remote number / identity (e.g. "+1 555 123 4567")
- Call direction label ("Incoming call" / "Outgoing call")
- Status badge: Ringing / Connecting / In call
- Call timer (mm:ss)
- Action buttons in a row:
  - Accept (green, only for incoming)
  - Reject / Hang up (red)
  - Mute / Unmute
  - Speaker / Earpiece

#### 2.2 SIP registration panel
- Title: "SIP Registration"
- Description: "Connect to Telnyx to make and receive calls."
- Status indicator dot with label: "Status: registered / connecting / disconnected / error"
- Connection details (read-only, auto-filled from account):
  - SIP Username
  - SIP Password (masked)
  - Phone number
- "Register / Re-register" button (disabled when already registered)
- Error message area (if registration fails)

#### 2.3 Dial pad card
- Title: "Dial Pad"
- Number input/display at top:
  - Large text, centered
  - Placeholder: "+1 555 123 4567"
  - Backspace button on the right
- 3x4 keypad grid:
  - 1 2 3
  - 4 5 6
  - 7 8 9
  - * 0 #
- Each key is a large tappable button
- Bottom row:
  - Call button (green, full width) — disabled when not registered or empty
  - Hang up button (red, only enabled during a call)

#### 2.4 Recent calls (optional, below dial pad)
- Title: "Recent calls"
- List items showing:
  - Number / contact name
  - Direction icon
  - Duration
  - Timestamp
- Empty state: "No recent calls"

### States
- **Not registered**: call button disabled, status yellow.
- **Registered**: status green, call button enabled.
- **Incoming call**: active call card appears, ring animation.
- **Outgoing call**: active call card appears, connecting status.
- **In call**: timer starts, mute/speaker controls active.
- **Call ended**: active call card disappears, item added to recent calls.

### Notes for designer
- The dial pad should feel tactile and responsive.
- Active call card should be impossible to miss.
- Use sound/animation cues for incoming calls (optional).

---

## 3. Messages (SMS/MMS)

**URL**: `/messages`
**Purpose**: Send and receive SMS and MMS messages.

### Layout
- Desktop: 2-column layout (conversation list 35%, chat area 65%).
- Tablet: 40% / 60%.
- Mobile: show one panel at a time (list or chat).

### Sections / Elements

#### 3.1 Conversation list (left panel)
- Header:
  - Title: "Messages"
  - Search input: "Search conversations..."
  - "New message" button (primary)
- List of conversation items:
  - Avatar or initials
  - Contact name or phone number
  - Last message preview (truncated)
  - Timestamp
  - Unread badge (if any)
- Active conversation highlighted with primary color background
- Empty state: "No conversations yet. Start one above."

#### 3.2 Chat area (right panel)
- Header:
  - Back arrow (mobile only, returns to list)
  - Contact avatar / initials
  - Contact name / number
  - Action buttons: call, info/menu
- Message feed:
  - Scrollable list of messages
  - Message bubbles:
    - Outbound: right-aligned, primary color background, white text
    - Inbound: left-aligned, surface color background, dark text
  - Each bubble contains:
    - Message text
    - Media preview (image, video, audio player) if MMS
    - Timestamp
    - Status icon for outbound (sent, delivered, failed)
- Date separators between different days

#### 3.3 Composer (bottom of chat area)
- Message input:
  - Placeholder: "Type a message..."
  - Auto-expand for multi-line text
- Attachment buttons:
  - Image icon (opens image picker)
  - Video icon (opens video picker)
  - Microphone icon (starts voice recording)
- Send button (paper plane icon) — disabled when empty or no assigned number

#### 3.4 New message flow
- Clicking "New message" opens an input to enter a phone number or select from contacts
- Then transitions to empty chat view

### States
- **No conversation selected**: chat area shows empty state with prompt.
- **No assigned number**: composer disabled, banner shows "Contact admin to activate messaging."
- **Sending**: input disabled, send button shows spinner.
- **Message failed**: red error icon on bubble, retry option.
- **Loading messages**: skeleton bubbles or spinner.

### Notes for designer
- Conversation list should feel like a native messaging app.
- Inbound/outbound bubble colors must be clearly distinguishable.
- Mobile UX is critical: easy switching between list and chat.

---

## 4. Contacts

**URL**: `/contacts`
**Purpose**: Manage a list of people the user communicates with.

### Layout
- Single-column card with a table or card list.
- Mobile: card list instead of table.

### Sections / Elements

#### 4.1 Header
- Title: "Contacts"
- Subtitle: "Manage people you call and message."
- "Add contact" button (primary, top-right)
- Search input: "Search contacts..."

#### 4.2 Contact list (desktop/tablet)
- Table columns:
  - Name
  - Phone number
  - Email
  - Actions
- Each row:
  - Avatar + name
  - Phone number
  - Email (optional, show "—" if empty)
  - Action buttons: Call, Message, Edit, Delete

#### 4.3 Contact cards (mobile)
- Each contact is a card:
  - Avatar + name
  - Phone number
  - Tap to expand actions

#### 4.4 Add/Edit contact modal
- Title: "Add contact" or "Edit contact"
- Avatar upload or initials generator
- Name input (required)
- Phone number input (required)
- Email input (optional)
- Notes textarea (optional)
- Footer buttons: Cancel, Save

#### 4.5 Delete confirmation modal
- Title: "Delete contact?"
- Text: "This will remove [Name] from your contacts."
- Buttons: Cancel, Delete (destructive)

### Empty states
- No contacts: "No contacts yet. Add your first contact to get started."

### Notes for designer
- Quick actions (call/message) should be accessible from the contact list without opening the contact.
- Consider a favorite/star feature for frequent contacts.

---

## 5. Settings

**URL**: `/settings`
**Purpose**: Manage user profile, preferences, and account details.

### Layout
- Single-column stack of cards.
- Grouped by category.

### Sections / Elements

#### 5.1 Profile card
- Title: "Profile"
- Avatar with initials or uploaded image
- "Change avatar" link (optional)
- Name input
- Email input (read-only or editable depending on policy)
- "Save profile" button

#### 5.2 Account number card
- Title: "Your Phonicity number"
- Large display of assigned number
- Status badge (Active / Pending / Suspended)
- Short description: "This is the number used for calls and messages."
- If pending: "Your number is being assigned by an admin."

#### 5.3 Appearance card
- Title: "Appearance"
- Theme selector:
  - Light
  - Dark
  - System
- Each option as a selectable card with icon

#### 5.4 Notifications card
- Title: "Notifications"
- Toggle for push notifications (optional)
- "Clear all notifications" button
- Count of stored notifications

#### 5.5 Account security card
- Title: "Account security"
- "Change password" button (opens modal or new page)
- "Log out" button
- "Delete account" link (destructive, with confirmation)

#### 5.6 Billing / Subscription card (if applicable)
- Title: "Subscription"
- Current plan name and price
- Renewal date
- "Manage billing" button (links to Stripe portal)

### Notes for designer
- Keep settings simple and grouped logically.
- The account number card should be prominent, similar to the Dashboard.

---

## 6. Notifications

**URL**: `/notifications`
**Purpose**: View all system and message notifications.

### Layout
- Single-column list of notification items.
- Header with count and actions.

### Sections / Elements

#### 6.1 Header
- Title: "Notifications"
- Subtitle: "Stay updated on calls, messages, and account activity."
- "Mark all as read" button
- "Clear all" button

#### 6.2 Notification list
Each item contains:
- Icon indicating type (message, call, system, warning)
- Title (e.g. "New message from +1 555 123 4567")
- Description (truncated)
- Timestamp
- Unread indicator (blue dot)
- Dismiss button (X icon)

#### 6.3 Notification types
- **Message**: `MessageSquare` icon, primary color
- **Call**: `Phone` icon, success color
- **System**: `Info` icon, info color
- **Warning**: `AlertTriangle` icon, warning color
- **Error**: `AlertCircle` icon, error color

### Empty states
- No notifications: "You're all caught up."
- All read: optional checkmark illustration.

### States
- **Unread**: blue dot, slightly bolder background.
- **Read**: normal text, no dot.
- **Hover**: show dismiss button.

### Notes for designer
- Distinguish unread items clearly.
- Swipe-to-dismiss on mobile (optional).

---

## 7. Shared User Dashboard Behaviors

### 7.1 Loading states
- Page-level: skeleton cards or spinners.
- Button-level: spinner inside button, disabled state.
- Lists: skeleton rows.

### 7.2 Error states
- Network error: inline retry button or toast.
- No assigned number: persistent banner at top of Messages/Calls.
- Permission denied: redirect to Dashboard with toast.

### 7.3 Success feedback
- Toast notification after saving settings.
- Toast after sending a message.
- Toast after adding a contact.

### 7.4 Mobile-specific notes
- Bottom tab bar or hamburger menu.
- Pull-to-refresh on Messages/Calls lists.
- Full-screen chat view on Messages.
- Active call UI should overlay other content if possible.

---

## 8. Assets the Designer Should Prepare

- Empty state illustrations for Dashboard, Messages, Calls, Contacts, Notifications
- Incoming/outgoing call iconography
- Message bubble design variants
- Contact avatar placeholder
- Notification type icons (already covered by Lucide)

---

*These are all user-facing dashboard pages. Once designs are approved, the next step is the admin dashboard specification.*
