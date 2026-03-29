# Project Structure

## Overview
UWI Study Space is a Next.js application for managing study room bookings at the University of the West Indies. It features role-based access (student, admin, super_admin), real-time availability, booking rules enforcement, and comprehensive admin panels.

---

## Directory Layout

```
.
├── .env.local
├── .eslintrc.json
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── PROJECT_STRUCTURE.md
├── README.md
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public
│   ├── Placeholder_Room.jpg
│   ├── ajl_normal.jpg
│   ├── assets
│   │   ├── almajordanHeader.jpg
│   │   ├── almjhero2.png
│   │   ├── books.png
│   │   ├── circuit_scope.png
│   │   └── uwi-logo.png
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── src
│   ├── app
│   │   ├── (app)
│   │   │   ├── admin
│   │   │   │   ├── bookings
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── reports
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── rooms
│   │   │   │   │   └── page.tsx
│   │   │   │   └── waitlist
│   │   │   │       └── page.tsx
│   │   │   ├── bookings
│   │   │   │   └── page.tsx
│   │   │   ├── complete-profile
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── rooms
│   │   │   │   └── page.tsx
│   │   │   ├── schedule
│   │   │   │   └── page.tsx
│   │   │   ├── super-admin
│   │   │   │   ├── bookings
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── departments
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── reports
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── rooms
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── settings
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── users
│   │   │   │   │   └── page.tsx
│   │   │   │   └── waitlist
│   │   │   │       └── page.tsx
│   │   │   └── waitlist
│   │   │       └── page.tsx
│   │   ├── (auth)
│   │   │   ├── forgot-password
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── login
│   │   │   │   └── page.tsx
│   │   │   ├── reset-password
│   │   │   │   └── page.tsx
│   │   │   ├── signup
│   │   │   │   └── page.tsx
│   │   │   └── verify
│   │   │       └── page.tsx
│   │   ├── api
│   │   │   ├── admin
│   │   │   │   ├── bookings
│   │   │   │   │   ├── [id]
│   │   │   │   │   │   ├── cancel
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   └── no-show
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── create
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   ├── create-booking
│   │   │   │   │   └── route.ts
│   │   │   │   ├── departments
│   │   │   │   │   └── allowed
│   │   │   │   │       └── route.ts
│   │   │   │   ├── mark-no-show
│   │   │   │   │   └── route.ts
│   │   │   │   ├── reports
│   │   │   │   │   └── route.ts
│   │   │   │   ├── rooms
│   │   │   │   │   ├── blackouts
│   │   │   │   │   │   ├── create
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   ├── delete
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   └── list
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── buffer
│   │   │   │   │   │   ├── get
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   └── update
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── create
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── opening-hours
│   │   │   │   │   │   ├── get
│   │   │   │   │   │   │   └── route.ts
│   │   │   │   │   │   └── update
│   │   │   │   │   │       └── route.ts
│   │   │   │   │   ├── status
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── toggle-active
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── update
│   │   │   │   │       └── route.ts
│   │   │   │   ├── settings
│   │   │   │   │   └── route.ts
│   │   │   │   ├── students
│   │   │   │   │   └── route.ts
│   │   │   │   └── waitlist
│   │   │   │       ├── [id]
│   │   │   │       │   ├── cancel
│   │   │   │       │   │   └── route.ts
│   │   │   │       │   ├── expire
│   │   │   │       │   │   └── route.ts
│   │   │   │       │   ├── fulfill
│   │   │   │       │   │   └── route.ts
│   │   │   │       │   └── offer
│   │   │   │       │       └── route.ts
│   │   │   │       ├── accept
│   │   │   │       │   └── route.ts
│   │   │   │       ├── join
│   │   │   │       │   └── route.ts
│   │   │   │       ├── list
│   │   │   │       │   └── route.ts
│   │   │   │       ├── my
│   │   │   │       │   └── route.ts
│   │   │   │       ├── offer
│   │   │   │       │   └── route.ts
│   │   │   │       └── route.ts
│   │   │   ├── bookings
│   │   │   │   ├── cancel
│   │   │   │   │   └── route.ts
│   │   │   │   └── create
│   │   │   │       └── route.ts
│   │   │   ├── cron
│   │   │   │   └── booking-reminders
│   │   │   │       └── route.ts
│   │   │   ├── departments
│   │   │   │   └── route.ts
│   │   │   ├── me
│   │   │   │   └── route.ts
│   │   │   ├── rooms
│   │   │   │   └── [id]
│   │   │   │       ├── availability
│   │   │   │       │   └── route.ts
│   │   │   │       └── status
│   │   │   │           └── route.ts
│   │   │   ├── super-admin
│   │   │   │   ├── departments
│   │   │   │   │   ├── create
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── delete
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── list
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── rename
│   │   │   │   │       └── route.ts
│   │   │   │   ├── scopes
│   │   │   │   │   └── set-departments
│   │   │   │   │       └── route.ts
│   │   │   │   ├── settings
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── update
│   │   │   │   │       └── route.ts
│   │   │   │   └── users
│   │   │   │       ├── list
│   │   │   │       │   └── route.ts
│   │   │   │       └── update-role
│   │   │   │           └── route.ts
│   │   │   └── waitlist
│   │   │       ├── accept
│   │   │       │   └── route.ts
│   │   │       ├── join
│   │   │       │   └── route.ts
│   │   │       └── my
│   │   │           └── route.ts
│   │   ├── auth
│   │   │   ├── callback
│   │   │   │   └── route.ts
│   │   │   └── continue
│   │   │       └── route.ts
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── admin
│   │   │   ├── NewRoomButton.tsx
│   │   │   ├── NewRoomModal.tsx
│   │   │   ├── RoomEditModal.tsx
│   │   │   ├── RoomRowActions.tsx
│   │   │   ├── bookings
│   │   │   │   ├── BookingsClient.tsx
│   │   │   │   └── BookingsPage.tsx
│   │   │   ├── reports
│   │   │   │   ├── ReportsClient.tsx
│   │   │   │   └── ReportsPage.tsx
│   │   │   ├── rooms
│   │   │   │   └── RoomsManagementPage.tsx
│   │   │   └── waitlist
│   │   │       ├── WaitlistManagement.tsx
│   │   │       └── WaitlistPage.tsx
│   │   ├── auth
│   │   │   ├── ProfileCompletionGate.tsx
│   │   │   └── UserBar.tsx
│   │   ├── bookings
│   │   │   ├── BookingsFilterBar.tsx
│   │   │   ├── MyBookingsCalendar.tsx
│   │   │   ├── MyBookingsList.tsx
│   │   │   ├── MyBookingsMonthCalendar.tsx
│   │   │   ├── MyOffersPanel.tsx
│   │   │   ├── SlotPicker.tsx
│   │   │   ├── SlotPickerModal.tsx
│   │   │   ├── SlotPickerModalAutoOpen.tsx
│   │   │   └── useRoomAvailability.ts
│   │   ├── landing
│   │   │   ├── About.tsx
│   │   │   ├── BookingOptions.tsx
│   │   │   ├── FAQ.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── RulesPreview.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── layout
│   │   │   └── SidebarLayout.tsx
│   │   ├── login
│   │   │   └── login
│   │   │       └── sign up
│   │   ├── rooms
│   │   │   ├── Filters.tsx
│   │   │   ├── RoomCard.tsx
│   │   │   └── RoomsDatePicker.tsx
│   │   ├── schedule
│   │   │   ├── ScheduleClient.tsx
│   │   │   └── ScheduleGrid.tsx
│   │   ├── shared
│   │   │   └── ExpiryCountdown.tsx
│   │   └── waitlist
│   │       └── StudentWaitlistPage.tsx
│   ├── hooks
│   │   └── use-mobile.ts
│   ├── lib
│   │   ├── api
│   │   │   └── routeParams.ts
│   │   ├── audit
│   │   │   └── write.ts
│   │   ├── booking
│   │   │   ├── rules.ts
│   │   │   └── time.ts
│   │   ├── db
│   │   │   ├── adminAllowedRooms.ts
│   │   │   ├── adminPanel.ts
│   │   │   ├── adminScopes.ts
│   │   │   ├── availability.ts
│   │   │   ├── bookings.ts
│   │   │   ├── myBookings.ts
│   │   │   ├── profiles.ts
│   │   │   ├── queries.ts
│   │   │   ├── rooms.ts
│   │   │   ├── schedule.ts
│   │   │   ├── settings.ts
│   │   │   ├── studentDashboard.ts
│   │   │   └── waitlist.ts
│   │   ├── email
│   │   │   ├── bookingEmailHelpers.ts
│   │   │   ├── resend.ts
│   │   │   ├── sendBookingCancellation.ts
│   │   │   ├── sendBookingConfirmation.ts
│   │   │   ├── sendBookingReminder.ts
│   │   │   ├── sendWaitlistOffer.ts
│   │   │   ├── templates
│   │   │   │   └── base.ts
│   │   │   └── testing.ts
│   │   ├── profile
│   │   │   └── options.ts
│   │   ├── schedule
│   │   │   └── buildMonthDTO.ts
│   │   ├── supabase
│   │   │   ├── admin.ts
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── utils
│   │       ├── datetime.ts
│   │       └── publicOrigin.ts
│   └── middleware.ts
└── tsconfig.json

130 directories, 184 files

```

---

## Key Features by Role

### Student
- **Dashboard**: View active/upcoming bookings, bookings left today
- **Browse Rooms**: Filter by building/capacity/amenities, see real-time availability
- **Schedule**: Monthly calendar, quick book from schedule
- **My Bookings**: List (paginated) or calendar view, manage bookings

### Department Admin
- **Rooms**: View/edit rooms in scope, toggle active state
- **Bookings**: View bookings for scoped rooms, mark no-show
- **Waitlist, Reports**: Department-level data
- **Settings**: Read-only access to global rules

### Super Admin
- **Full Access**: Everything + global settings
- **Departments**: Create/rename/delete departments
- **Users**: Manage roles, assign department scopes
- **Settings**: Edit booking rules, enforcement thresholds

---

## Data Flow

### Student Booking Flow
1. Student filters rooms (/rooms)
2. Selects room + date → SlotPickerModal opens
3. Picks slot & purpose → POST /api/bookings/create
4. Server validates rules (overlaps, max/day, no-show ban, etc.)
5. Insert via service role + audit log
6. Response with bookingId

### Admin No-Show Flow
1. Admin views booking in admin panel
2. Clicks "Mark No-Show" → POST /api/admin/mark-no-show
3. Server validates (active, not future, scope check)
4. Update status + audit log
5. Booking marked as no_show

### Admin Create Booking (on behalf of user)
1. Admin creates booking in admin panel (for student or external)
2. POST /api/admin/create-booking (with optional bookedForUserId)
3. Server enforces scope + booking rules
4. Insert + audit log

---

## Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000

# Build for production
npm run build
npm run start

# Lint
npm run lint

# Format code
npm run format
```

---

## Notes

- **Middleware Deprecated**: The `middleware.ts` file convention is deprecated in Next.js. Consider migrating to the "proxy" pattern instead.
- **RLS**: Row-level security enforces per-user/role access on the Supabase side
- **Service Role**: Admin API routes use service role (bypasses RLS) with explicit authorization checks
- **Audit Logging**: Best-effort; failures don't block main operations
- **Timezone**: Trinidad (UTC-4, no DST) for day/slot calculations
- **Pagination**: Bookings list uses cursor-based or offset pagination
- **Slots**: Time-based (e.g., 60-min slots); configurable via settings
- **Blackouts**: Temporary room closures (e.g., maintenance)
- **Opening Hours**: Per-room, per-day-of-week (e.g., 8 AM–8 PM, closed Sundays)
- **No-Show Rules**: Threshold + window (e.g., 3 no-shows in 30 days = ban for 14 days)

---

## Future Enhancements

- Email notifications (booking confirmations, reminders, waitlist offers)
- Waitlist auto-promotion & offer system
- Advanced reporting (utilization, peak times, etc.)
- Custom recurring bookings
- Video conference integration
- Mobile app (React Native)
- Accessibility audit & WCAG compliance