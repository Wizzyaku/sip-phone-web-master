# Phonicity — UI/UX Design Specification

## 1. Project Overview

Phonicity is a browser-based communication platform that combines SIP voice calling, SMS/MMS messaging, and contact management. Users log in, are assigned a phone number by an admin, and can immediately start calling and texting without any technical setup.

### Core value proposition
- Zero setup for end users after login.
- Web-based softphone + messaging in one dashboard.
- Admin-controlled phone number provisioning.

### Target users
- **End users**: People who need a business phone number accessible from the browser.
- **Admins**: Staff who review signups, process payments, and assign phone numbers.

---

## 2. Information Architecture

```
Phonicity
├── Public pages
│   ├── Login
│   ├── Signup
│   ├── Forgot password
│   └── Payment page (post-signup)
├── User dashboard
│   ├── Dashboard (home)
│   ├── Calls (SIP softphone)
│   ├── Messages (SMS/MMS)
│   ├── Contacts
│   ├── Settings
│   └── Notifications
└── Admin dashboard
    ├── Admin overview
    ├── Users management
    ├── Phone numbers inventory
    ├── Payments / approvals
    └── Messages monitoring (optional)
```

---

## 3. Global Components

These components appear across multiple pages.

### 3.1 App shell
- **Top navigation bar**: search, notification bell, theme toggle, user avatar.
- **Sidebar**: logo, main navigation links, active state indicator.
- **Mobile**: collapsible hamburger menu or bottom navigation.

### 3.2 Cards
- Used for dashboard widgets, forms, and lists.
- Consistent padding, shadow, rounded corners.

### 3.3 Tables
- Used in admin pages for users, numbers, and payments.
- Sortable columns, pagination, row actions.

### 3.4 Modals
- Confirmation dialogs.
- Edit forms (e.g. assign number, approve user).
- Payment status details.

### 3.5 Toast notifications
- Success, error, warning, info states.
- Auto-dismiss after a few seconds.

### 3.6 Empty states
- Friendly illustrations/messages when no data exists.
- Clear CTA to add or create something.

### 3.7 Loading states
- Skeleton loaders for tables and lists.
- Spinners for buttons and async actions.

### 3.8 Forms
- Labels, helper text, validation errors.
- Required field indicators.

---

## 4. Public Pages

### 4.1 Login
**Purpose**: Authenticate existing users.

**Sections**:
- Branded header/logo
- Email input
- Password input
- "Remember me" checkbox
- Login button
- "Forgot password?" link
- "Don't have an account? Sign up" link

### 4.2 Signup
**Purpose**: Register a new user account.

**Sections**:
- Branded header/logo
- Full name input
- Email input
- Phone number input (optional, for account recovery)
- Password input with strength indicator
- Confirm password input
- Terms of service and privacy policy checkbox
- Sign up button
- "Already have an account? Log in" link

### 4.3 Forgot Password
**Purpose**: Reset user password via email.

**Sections**:
- Email input
- Send reset link button
- Success message after submission
- Back to login link

### 4.4 Payment Page
**Purpose**: Collect payment after signup before account activation.

**Sections**:
- Order summary (plan name, price)
- Payment method selector (card, bank transfer, etc.)
- Card details form
- Pay button
- Payment status feedback
- Contact support link

---

## 5. User Dashboard Pages

### 5.1 Dashboard (Home)
**Purpose**: Quick overview of activity and shortcuts.

**Sections**:
- Welcome header with user name
- Stats cards row:
  - Total calls today
  - Total messages today
  - Unread messages
  - Account status (active / pending)
- Recent activity feed (last 5 calls/messages)
- Quick action buttons:
  - Start new call
  - Send new message
- Assigned phone number card (prominently displayed)

### 5.2 Calls (SIP Softphone)
**Purpose**: Make and receive voice calls.

**Sections**:
- Active call card (shows when in a call):
  - Caller ID / number
  - Call status (Ringing, In call, Connecting)
  - Call timer
  - Accept / Reject / Hangup buttons
  - Mute and speaker toggle buttons
- SIP registration panel:
  - Connection status indicator
  - Register / Re-register button
  - Error message area
- Dial pad card:
  - Number display/input
  - 3x4 keypad (0-9, *, #)
  - Backspace button
  - Call and hangup buttons
- Recent calls list (optional, below dial pad)

**Notes for designer**:
- The dial pad should feel like a physical phone.
- Active call card should be visually prominent.
- Status indicators use color: green (registered), red (error), yellow (connecting).

### 5.3 Messages (SMS/MMS)
**Purpose**: Send and receive text and media messages.

**Sections**:
- Left sidebar: conversation list
  - Search conversations
  - List of contacts with last message preview
  - Unread badge
  - Active conversation highlight
- Main chat area:
  - Conversation header (contact name/number)
  - Message bubbles (inbound right-aligned, outbound left-aligned or vice versa)
  - Timestamp per message
  - Message status (sent, delivered, failed)
  - Media previews (images, audio, video)
- Composer area:
  - Message input
  - Attachment buttons (image, video, audio/record)
  - Send button
  - Character counter (optional)
- Empty state when no conversation is selected

**Notes for designer**:
- Conversation list should be responsive: full screen on mobile, sidebar on desktop.
- Message bubbles need clear inbound/outbound distinction.
- Provide a clear "no sender number" empty state if the admin has not assigned a number yet.

### 5.4 Contacts
**Purpose**: Manage contacts for calls and messaging.

**Sections**:
- Header with "Add contact" button
- Search input
- Contact list/table:
  - Name
  - Phone number
  - Email (optional)
  - Actions (call, message, edit, delete)
- Add/Edit contact modal:
  - Name input
  - Phone input
  - Email input
  - Notes textarea
  - Save / Cancel buttons
- Empty state when no contacts exist

### 5.5 Settings
**Purpose**: Manage user preferences and account info.

**Sections**:
- Profile card:
  - Avatar
  - Name input
  - Email input (read-only or editable)
  - Save button
- Assigned number card:
  - Display assigned Telnyx number
  - Status (active / pending / suspended)
  - No input needed unless admin allows changing
- Appearance card:
  - Theme selector (Light / Dark / System)
- Notifications card:
  - Clear notifications button
- Account card:
  - Change password link
  - Log out button

### 5.6 Notifications
**Purpose**: View system and message notifications.

**Sections**:
- List of notifications
- Mark as read / dismiss actions
- Clear all button
- Empty state

---

## 6. Admin Dashboard Pages

### 6.1 Admin Overview
**Purpose**: High-level admin metrics.

**Sections**:
- Page title "Admin Overview"
- Stats cards:
  - Total users
  - Active users
  - Pending approvals
  - Available phone numbers
  - Revenue today / this month
- Charts (optional):
  - Signups over time
  - Messages sent over time
  - Calls made over time
- Quick action buttons:
  - View pending users
  - Add phone number
  - Manage payments

### 6.2 Users Management
**Purpose**: Review, approve, suspend, and manage all users.

**Sections**:
- Header with "Invite user" or "Add user" button
- Filters:
  - Status (all, pending, active, suspended)
  - Role (user, admin)
  - Search by name/email
- Users table columns:
  - Name
  - Email
  - Phone number assigned
  - Status badge
  - Role badge
  - Created date
  - Actions (view, edit, approve, suspend, delete)
- User detail modal/sidebar:
  - Profile info
  - Assigned number
  - Payment status
  - Message/call history summary
  - Admin actions (approve, assign number, suspend, delete)

### 6.3 Phone Numbers Inventory
**Purpose**: Manage Telnyx phone numbers available for assignment.

**Sections**:
- Header with "Add number" button
- Stats cards:
  - Total numbers
  - Available numbers
  - Assigned numbers
- Numbers table columns:
  - Phone number
  - Status (available, assigned)
  - Assigned user (if any)
  - SIP username
  - SIP password (hidden, show/hide toggle)
  - Actions (edit, assign, release, delete)
- Add/Edit number modal:
  - Phone number input
  - SIP username input
  - SIP password input
  - Assign to user dropdown (optional)
  - Save button

### 6.4 Payments / Approvals
**Purpose**: Review payment records and approve users after payment.

**Sections**:
- Header with filters:
  - Status (pending, completed, failed, refunded)
  - Date range
- Payments table columns:
  - User name/email
  - Amount
  - Payment method
  - Status badge
  - Date
  - Actions (view, approve, refund, mark complete)
- Payment detail modal:
  - User info
  - Plan details
  - Transaction reference
  - Admin actions

### 6.5 Messages Monitoring (Optional)
**Purpose**: Admin oversight of messages for compliance/support.

**Sections**:
- Search by user or phone number
- Date range filter
- Messages table:
  - Sender
  - Recipient
  - Direction (inbound/outbound)
  - Body preview
  - Timestamp
  - Status
- Message detail view

### 6.6 Admin Settings
**Purpose**: Configure platform-wide settings.

**Sections**:
- Telnyx integration settings:
  - API key
  - Default messaging profile
  - Webhook URL
- Notification settings:
  - Email templates
  - Admin alert recipients
- Pricing plans:
  - Plan name
  - Price
  - Included minutes/messages
- Platform branding:
  - App name
  - Logo upload
  - Primary color

---

## 7. Responsive Behavior

### Desktop (1024px+)
- Sidebar always visible.
- Messages page uses two-column layout (conversations + chat).
- Admin tables show all columns.

### Tablet (768px–1023px)
- Sidebar collapses to icons.
- Tables may hide less important columns.

### Mobile (<768px)
- Sidebar becomes bottom navigation or hamburger menu.
- Messages page shows either conversation list or chat, not both.
- Dial pad takes full width.
- Tables become card lists.

---

## 8. Design System Suggestions

### Color palette
- **Primary**: blue/indigo (trust, communication)
- **Success**: green
- **Warning**: amber/yellow
- **Error**: red
- **Background**: light and dark mode support

### Typography
- Sans-serif font (e.g. Inter, Geist, or system default)
- Clear hierarchy: page titles, section titles, body, captions

### Spacing
- Consistent 4px/8px grid system
- Cards with rounded corners (e.g. 12px)
- Generous whitespace for readability

### Icons
- Use Lucide icons (already used in the codebase)
- Keep icon sizes consistent across the app

---

## 9. Empty States & Error Handling

### Common empty states
- No messages yet
- No calls yet
- No contacts yet
- No notifications
- No pending approvals
- No assigned number (user sees CTA to contact admin or payment flow)

### Error states
- Failed registration
- Failed message send
- Network error
- Unauthorized access to admin pages

---

## 10. Future Enhancements

- Real-time messaging via WebSockets or Supabase realtime.
- Voicemail / call recording.
- Call history and analytics.
- Multi-device support.
- Mobile app (PWA or native).
- Auto-provisioning of Telnyx numbers via API.
- Subscription billing with Stripe.

---

## 11. Files/Assets the Designer May Need

- Logo (light and dark versions)
- Hero illustrations for empty states
- Favicon
- App icons for PWA
- Loading skeletons
- Mock avatar images

---

*This document is intended for the UI/UX designer to understand the full scope of pages, sections, and user flows before producing high-fidelity designs.*
