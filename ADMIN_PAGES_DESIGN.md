# Phonicity — Admin Dashboard Pages Design Specification

*This document details the design of every admin dashboard page so the UI/UX designer can produce high-fidelity designs without ambiguity.*

---

## 1. Admin Overview

**URL**: `/admin`
**Purpose**: Give admins a high-level view of platform activity and quick access to common admin tasks.

### Layout
- Top: page title + date range selector (today, 7 days, 30 days, custom).
- Main grid:
  - Top row: 4–6 key metric cards.
  - Middle row: charts for signups and activity.
  - Bottom row: quick action cards + pending approvals preview.

### Sections / Elements

#### 1.1 Page header
- Title: "Admin Overview"
- Subtitle: "Platform health and key metrics at a glance."
- Date range picker (top-right)

#### 1.2 Key metric cards (responsive grid)
Each card has:
- Icon
- Label
- Large numeric value
- Optional trend indicator (up/down vs previous period)

Cards:
1. **Total users** — `Users` icon
2. **Active users** — `UserCheck` icon
3. **Pending approvals** — `Clock` icon (highlighted in warning color)
4. **Available phone numbers** — `Phone` icon
5. **Revenue this period** — `DollarSign` icon
6. **Messages sent this period** — `MessageSquare` icon

#### 1.3 Charts area
- **Signups over time** — line chart
- **Messages sent over time** — bar chart
- **Calls made over time** — bar chart
- Empty state: "No data for selected period"

#### 1.4 Quick actions
- Title: "Quick actions"
- 4 buttons/cards:
  - "Review pending users" → links to Users page filtered by pending
  - "Add phone number" → opens add-number modal
  - "View payments" → links to Payments page
  - "Platform settings" → links to Admin Settings

#### 1.5 Pending approvals preview
- Title: "Pending approvals"
- Table of last 5 users awaiting approval
- Columns: name, email, signup date, payment status, "Review" action
- "View all" link to Users page

### Empty states
- No pending approvals: "No users waiting for approval."
- No data for charts: "No activity in this period yet."

### Notes for designer
- This is the admin's command center. Prioritize scannability and clear CTA for pending approvals.
- Use warning color to draw attention to pending items.

---

## 2. Users Management

**URL**: `/admin/users`
**Purpose**: Manage all users: approve, suspend, edit, delete, and assign phone numbers.

### Layout
- Top: header + filters + search.
- Main: data table with pagination.
- Side: user detail slide-out panel or modal.

### Sections / Elements

#### 2.1 Header
- Title: "Users"
- Subtitle: "Manage users and their access."
- "Invite user" or "Add user" button (primary)

#### 2.2 Filters and search bar
- Search input: "Search by name or email..."
- Status filter dropdown: All, Pending, Active, Suspended
- Role filter dropdown: All, User, Admin
- Date range filter (optional)
- Clear filters button

#### 2.3 Users table
Columns:
1. Name (with avatar/initials)
2. Email
3. Phone number assigned (or "—")
4. Status badge (Pending / Active / Suspended)
5. Role badge (User / Admin)
6. Created date
7. Actions (view, edit, approve, suspend, delete)

Row actions menu:
- View details
- Edit user
- Assign number
- Approve / Suspend (toggle based on status)
- Reset password
- Delete

#### 2.4 User detail panel / modal
- Header: avatar, name, email, status badge
- Tabs:
  - **Overview**: signup date, last active, assigned number, role
  - **Messages**: recent message history (read-only)
  - **Calls**: recent call history (read-only)
  - **Payments**: payment history
- Admin actions at bottom:
  - Approve / Suspend button
  - Assign number button
  - Make admin / Remove admin (role toggle)
  - Delete user (destructive)

#### 2.5 Add/Edit user modal
- Title: "Add user" or "Edit user"
- Fields:
  - Full name
  - Email
  - Phone number (optional)
  - Role (User / Admin)
  - Status (Pending / Active / Suspended)
  - Password (only for add)
- Footer: Cancel, Save

#### 2.6 Approve user modal
- Title: "Approve user?"
- Content: user info + dropdown to assign a phone number
- Buttons: Cancel, Approve

#### 2.7 Suspend user modal
- Title: "Suspend user?"
- Reason textarea (optional)
- Buttons: Cancel, Suspend

#### 2.8 Delete user modal
- Title: "Delete user?"
- Warning text: "This action cannot be undone. All data associated with this user will be permanently removed."
- Confirmation input: "Type DELETE to confirm"
- Buttons: Cancel, Delete (destructive)

### Empty states
- No users: "No users found."
- No matching filters: "No users match your filters. Try adjusting them."

### Notes for designer
- Status badges should be color-coded: pending = amber, active = green, suspended = red.
- The user detail panel should feel like a CRM record.
- Bulk actions (select multiple rows) are optional but useful for later.

---

## 3. Phone Numbers Inventory

**URL**: `/admin/numbers`
**Purpose**: Manage the pool of Telnyx phone numbers available for assignment to users.

### Layout
- Top: header + stats + add button.
- Main: data table with filters.
- Modals: add/edit number, assign to user.

### Sections / Elements

#### 3.1 Header
- Title: "Phone Numbers"
- Subtitle: "Manage available and assigned phone numbers."
- "Add number" button (primary)

#### 3.2 Stats cards
- Total numbers
- Available numbers
- Assigned numbers
- Numbers pending provisioning (optional)

#### 3.3 Filters and search
- Search: "Search by number..."
- Status filter: All, Available, Assigned
- Assigned user filter: dropdown of users
- Clear filters button

#### 3.4 Numbers table
Columns:
1. Phone number (formatted)
2. Status badge (Available / Assigned)
3. Assigned user (name or email, or "—")
4. SIP username
5. SIP password (masked, with show/hide toggle icon)
6. Messaging profile / notes
7. Created date
8. Actions

Row actions:
- View details
- Edit
- Assign to user
- Release from user
- Delete

#### 3.5 Add number modal
- Title: "Add phone number"
- Fields:
  - Phone number (E.164 format, e.g. +14237303370)
  - SIP username
  - SIP password
  - Telnyx messaging profile ID (optional)
  - Notes (optional)
  - Assign to user dropdown (optional, can be left unassigned)
- Footer: Cancel, Save

#### 3.6 Edit number modal
- Same fields as Add number
- Title: "Edit phone number"

#### 3.7 Assign number modal
- Title: "Assign number to user"
- Number display (read-only)
- User dropdown (searchable)
- Footer: Cancel, Assign

#### 3.8 Release number modal
- Title: "Release number?"
- Text: "This will unassign [number] from [user]."
- Footer: Cancel, Release

#### 3.9 Delete number modal
- Title: "Delete number?"
- Warning: "This will remove [number] from the system. This action cannot be undone."
- Footer: Cancel, Delete

### Empty states
- No numbers: "No phone numbers added. Add your first number to begin assigning users."
- No available numbers: "All numbers are assigned. Add more numbers or release existing ones."

### Notes for designer
- SIP password should be masked by default. Show/hide toggle should be obvious.
- Format phone numbers consistently (e.g. +1 423 730 3370).
- Highlight available numbers in green.

---

## 4. Payments / Approvals

**URL**: `/admin/payments`
**Purpose**: Review payment records, verify payments, and approve users after payment.

### Layout
- Top: header + filters.
- Main: data table.
- Side: payment detail modal.

### Sections / Elements

#### 4.1 Header
- Title: "Payments"
- Subtitle: "Review and manage user payments."
- "Record manual payment" button (optional)

#### 4.2 Filters
- Search: "Search by user..."
- Status filter: All, Pending, Completed, Failed, Refunded
- Date range picker
- Payment method filter: Card, Bank Transfer, Mobile Money
- Clear filters

#### 4.3 Payments table
Columns:
1. User (name + email)
2. Amount
3. Payment method
4. Status badge (Pending / Completed / Failed / Refunded)
5. Plan name
6. Transaction reference
7. Date
8. Actions

Row actions:
- View details
- Mark as complete
- Approve user (if pending)
- Refund
- Retry (if failed)

#### 4.4 Payment detail modal
- Header: user info + amount + status badge
- Fields (read-only):
  - Plan
  - Amount
  - Payment method
  - Transaction reference
  - Date
  - Billing details
- Admin actions:
  - Mark as complete
  - Approve associated user
  - Refund payment
  - Close

#### 4.5 Manual payment modal (optional)
- Title: "Record manual payment"
- User dropdown
- Amount input
- Payment method dropdown
- Transaction reference input
- Notes textarea
- Footer: Cancel, Save

### Empty states
- No payments: "No payments recorded yet."
- No matching filters: "No payments match your filters."

### Notes for designer
- Pending payments should be visually prominent (amber badge).
- Completed payments use green, failed use red, refunded use neutral gray.
- The payment detail modal should clearly separate read-only info from admin actions.

---

## 5. Messages Monitoring (Optional)

**URL**: `/admin/messages`
**Purpose**: Provide admin oversight of all messages for compliance, support, and debugging.

### Layout
- Top: header + filters + search.
- Main: data table.
- Side: message detail view.

### Sections / Elements

#### 5.1 Header
- Title: "Messages Monitoring"
- Subtitle: "Review user messages for compliance and support."

#### 5.2 Filters
- Search: "Search by sender, recipient, or user..."
- User filter: dropdown
- Direction filter: All, Inbound, Outbound
- Date range picker
- Status filter: Sent, Delivered, Failed, Received

#### 5.3 Messages table
Columns:
1. User (who sent/received)
2. From number
3. To number
4. Direction badge
5. Body preview (truncated)
6. Timestamp
7. Status badge
8. Actions (view)

#### 5.4 Message detail panel
- Full message body
- Media preview if MMS
- Sender/recipient numbers
- Direction
- Timestamp
- Status
- Associated user

### Notes for designer
- This is a sensitive area. Consider showing only a body preview in the table and requiring a click to view full content.
- Include a clear privacy/compliance notice at the top of the page.

---

## 6. Admin Settings

**URL**: `/admin/settings`
**Purpose**: Configure platform-wide settings and integrations.

### Layout
- Single-column stack of cards, grouped by category.

### Sections / Elements

#### 6.1 Telnyx integration card
- Title: "Telnyx integration"
- Fields:
  - Telnyx API key (password input, masked)
  - Default messaging profile ID
  - Webhook URL (read-only, generated by platform)
- "Test connection" button
- "Save" button

#### 6.2 Supabase / Auth settings card
- Title: "Authentication"
- Fields:
  - Supabase URL (read-only)
  - Allow public signup toggle
  - Require email verification toggle
  - Require admin approval toggle
- "Save" button

#### 6.3 Notification settings card
- Title: "Notifications"
- Fields:
  - Admin email recipients (multi-input)
  - Notify on new signup toggle
  - Notify on new payment toggle
  - Notify on low number inventory toggle
- "Save" button

#### 6.4 Pricing plans card
- Title: "Pricing plans"
- List of plans with:
  - Plan name
  - Price
  - Billing period
  - Included minutes
  - Included messages
- "Add plan" button
- Edit/Delete actions per plan

#### 6.5 Branding card
- Title: "Branding"
- Fields:
  - App name input
  - Logo upload (light and dark variants)
  - Primary color picker
- Preview of logo in light/dark mode
- "Save" button

#### 6.6 Danger zone card
- Title: "Danger zone"
- Actions:
  - "Export all data"
  - "Reset platform settings" (with confirmation)
  - "Delete all data" (with double confirmation)

### Notes for designer
- Group related settings clearly.
- Sensitive fields (API keys) should always be masked with a show toggle.
- The danger zone should be visually separated and use destructive styling.

---

## 7. Shared Admin Dashboard Behaviors

### 7.1 Admin access
- Admin pages should only be accessible to users with the `admin` role.
- Non-admin users redirected to Dashboard with an error toast.
- Optional "Admin" badge in the top navigation when logged in as admin.

### 7.2 Data tables
- Sortable columns.
- Pagination at bottom.
- Row hover effect.
- Action menus (three dots) to reduce clutter.
- Bulk selection (optional, checkbox per row + bulk action bar).

### 7.3 Loading and empty states
- Tables show skeleton rows while loading.
- Empty state has a clear message and optional CTA.

### 7.4 Confirmations
- Destructive actions always show a confirmation modal.
- Some actions require typed confirmation (e.g. "DELETE").

### 7.5 Success/error feedback
- Toasts for save, approve, delete, assign actions.
- Inline error messages for form validation.

### 7.6 Responsive behavior
- Desktop: full tables with all columns.
- Tablet: hide less important columns, show action menus.
- Mobile: cards instead of tables, slide-out panels instead of modals where appropriate.

---

## 8. Admin Navigation

### Sidebar additions (for admin users)
- **Admin** section header in sidebar
- Links:
  - Admin Overview
  - Users
  - Phone Numbers
  - Payments
  - Messages Monitoring
  - Admin Settings

### Mobile
- Admin links appear in the same bottom navigation or hamburger menu.
- Consider a separate admin-only menu mode if the list is long.

---

## 9. Assets the Designer Should Prepare

- Admin dashboard hero icons for stat cards
- Empty state illustrations for each admin page
- Chart/graph color palette
- Modal confirmation illustrations (optional)
- Status badge variants (pending, active, suspended, available, assigned, completed, failed, refunded)

---

*These are all admin dashboard pages. Combined with the public and user dashboard specs, this completes the full UI/UX design scope for Phonicity.*
