# Project Structure

## Overview
UWI Study Space is a Next.js application for managing study room bookings at the University of the West Indies. It features role-based access (student, admin, super_admin), real-time availability, booking rules enforcement, and comprehensive admin panels.

---

## Directory Layout

```
uwi-study-space/
├── public/                          # Static assets
│   └── ajl_normal.jpg              # Library image
│
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (app)/                  # Protected app routes (auth required)
│   │   │   ├── layout.tsx          # App shell with SidebarLayout + ProfileCompletionGate
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        # Student dashboard (stats, upcoming bookings)
│   │   │   ├── rooms/
│   │   │   │   └── page.tsx        # Browse & filter rooms, book room modal
│   │   │   ├── schedule/
│   │   │   │   └── page.tsx        # Monthly calendar view with quick book
│   │   │   ├── bookings/
│   │   │   │   └── page.tsx        # My bookings (list & calendar views)
│   │   │   ├── admin/              # Department admin routes
│   │   │   │   ├── layout.tsx      # Admin shell with tabs + role gating
│   │   │   │   ├── page.tsx        # Admin home placeholder
│   │   │   │   ├── rooms/
│   │   │   │   │   └── page.tsx    # Manage rooms (edit, toggle active)
│   │   │   │   ├── bookings/
│   │   │   │   │   └── page.tsx    # Admin view all bookings
│   │   │   │   ├── waitlist/
│   │   │   │   │   └── page.tsx    # Waitlist management
│   │   │   │   └── reports/
│   │   │   │       └── page.tsx    # Reports & analytics
│   │   │   └── super-admin/        # Super admin only routes
│   │   │       ├── layout.tsx      # Super admin shell with tabs
│   │   │       ├── page.tsx        # Super admin home
│   │   │       ├── rooms/
│   │   │       │   └── page.tsx    # Manage all rooms
│   │   │       ├── bookings/
│   │   │       │   └── page.tsx    # View all bookings
│   │   │       ├── departments/
│   │   │       │   └── page.tsx    # Create/rename/delete departments
│   │   │       ├── users/
│   │   │       │   └── page.tsx    # Manage users, roles, scopes
│   │   │       ├── waitlist/
│   │   │       │   └── page.tsx    # Global waitlist management
│   │   │       ├── reports/
│   │   │       │   └── page.tsx    # Global reports
│   │   │       └── settings/
│   │   │           └── page.tsx    # Booking rules, enforcement settings
│   │   ├── (auth)/                 # Auth routes (no sidebar)
│   │   │   └── login/
│   │   │       └── page.tsx        # Login page (Supabase Auth)
│   │   ├── api/                    # API routes
│   │   │   ├── me/
│   │   │   │   └── route.ts        # GET /api/me (current user + role)
│   │   │   ├── departments/
│   │   │   │   └── route.ts        # GET /api/departments (list all)
│   │   │   ├── bookings/
│   │   │   │   └── create/
│   │   │   │       └── route.ts    # POST /api/bookings/create (student booking)
│   │   │   ├── admin/
│   │   │   │   ├── toggle-active/
│   │   │   │   │   └── route.ts    # POST toggle room active state
│   │   │   │   ├── create-booking/
│   │   │   │   │   └── route.ts    # POST admin creates booking for user/external
│   │   │   │   ├── mark-no-show/
│   │   │   │   │   └── route.ts    # POST mark booking as no_show
│   │   │   │   ├── rooms/
│   │   │   │   │   └── update/
│   │   │   │   │       └── route.ts # PATCH update room details
│   │   │   │   └── settings/
│   │   │   │       └── route.ts    # PATCH update global settings (super admin)
│   │   │   └── super-admin/
│   │   │       ├── users/
│   │   │       │   ├── list/
│   │   │       │   │   └── route.ts # GET users list
│   │   │       │   └── update-role/
│   │   │       │       └── route.ts # POST update user role
│   │   │       ├── scopes/
│   │   │       │   └── set-departments/
│   │   │       │       └── route.ts # POST set admin department scope
│   │   │       └── departments/
│   │   │           ├── create/
│   │   │           ├── list/
│   │   │           ├── rename/
│   │   │           └── delete/
│   │   │               └── route.ts # CRUD for departments
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Public landing page
│   │   └── globals.css             # Global Tailwind styles
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── UserBar.tsx         # Show current user email + role
│   │   │   └── ProfileCompletionGate.tsx # Redirect if profile incomplete
│   │   ├── layout/
│   │   │   └── SidebarLayout.tsx   # Main sidebar + nav (student/admin/super-admin versions)
│   │   ├── rooms/
│   │   │   ├── Filters.tsx         # Building, capacity, amenity filters
│   │   │   ├── RoomCard.tsx        # Room card with status, hours, amenities
│   │   │   ├── RoomsDatePicker.tsx # Date carousel (7-day view)
│   │   │   └── RoomsByDepartment.tsx # (optional) Group rooms by dept
│   │   ├── bookings/
│   │   │   ├── BookingsFilterBar.tsx    # When/status/view mode filters
│   │   │   ├── MyBookingsList.tsx       # Booking cards with pagination
│   │   │   ├── MyBookingsCalendar.tsx   # Calendar view of bookings
│   │   │   ├── MyBookingsMonthCalendar.tsx # Month calendar for bookings
│   │   │   └── SlotPickerModal.tsx      # Modal to select time slots
│   │   ├── schedule/
│   │   │   ├── ScheduleClient.tsx  # Month selector, day picker, quick book
│   │   │   └── ScheduleGrid.tsx    # Time-grid view of rooms + busy intervals
│   │   ├── admin/
│   │   │   ├── rooms/
│   │   │   │   ├── RoomsManagementPage.tsx # Shared rooms mgmt (admin + super-admin)
│   │   │   │   ├── RoomEditModal.tsx       # Edit room details
│   │   │   │   └── RoomRowActions.tsx      # Toggle active, edit, delete
│   │   │   ├── bookings/
│   │   │   │   └── AdminBookingsList.tsx   # Admin view of bookings
│   │   │   └── waitlist/
│   │   │       └── WaitlistManagement.tsx  # Waitlist CRUD
│   │   └── shared/
│   │       └── (future shared components)
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts           # Supabase client (server-side, auth cookie)
│   │   │   ├── client.ts           # Supabase client (browser)
│   │   │   └── admin.ts            # Supabase admin client (service role)
│   │   ├── db/
│   │   │   ├── rooms.ts            # getRoomById, getRoomsFiltered, etc.
│   │   │   ├── bookings.ts         # Booking CRUD helpers
│   │   │   ├── availability.ts     # getRoomAvailabilityForDate, slot building
│   │   │   ├── myBookings.ts       # getMyBookingsPaged, calendar queries
│   │   │   ├── schedule.ts         # getRoomsForSchedule, getActiveBookingsBetween
│   │   │   ├── studentDashboard.ts # getStudentDashboard (stats + upcoming)
│   │   │   ├── adminPanel.ts       # Admin queries (bookings, waitlist, stats)
│   │   │   ├── adminScopes.ts      # adminHasRoomAccess, getUserDepartments
│   │   │   ├── settings.ts         # getSettings, updateSettings
│   │   │   ├── queries.ts          # General queries (filtered rooms, booked slots)
│   │   │   └── departments.ts      # getDepartments, createDept, renameDept
│   │   ├── booking/
│   │   │   ├── rules.ts            # validateBooking, checkOverlaps, enforceMaxDays
│   │   │   └── time.ts             # buildSlotsForDay, time helpers
│   │   ├── schedule/
│   │   │   └── buildMonthDTO.ts    # ScheduleMonthDTO + month building logic
│   │   ├── audit/
│   │   │   └── write.ts            # writeAuditLog (best-effort logging)
│   │   └── utils/
│   │       └── (utility helpers as needed)
│   │
│   └── middleware.ts               # Redirect logic (auth checks, profile completion)
│
├── .env.local                      # Environment variables (local dev)
├── .eslintrc.json                  # ESLint config
├── .gitignore                      # Git ignore rules
├── .prettierignore                 # Prettier ignore patterns
├── .prettierrc.json                # Prettier config
├── eslint.config.mjs               # ESLint config (modern)
├── next.config.ts                  # Next.js config
├── package.json                    # Dependencies & scripts
├── postcss.config.mjs              # PostCSS config (Tailwind)
├── PROJECT_STRUCTURE.md            # This file
├── README.md                        # Setup & overview
├── tsconfig.json                   # TypeScript config
└── next-env.d.ts                   # Auto-generated Next.js types

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