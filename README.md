# UWI Study Spaces

A secure, web-based study room booking and management system developed for the **Alma Jordan Library, The University of the West Indies, St. Augustine Campus**. The platform replaces the existing manual, paper-based process with a centralized digital system for viewing availability, creating reservations, managing rooms, and enforcing booking policies. 

## Overview

The Alma Jordan Library experiences high demand for study rooms, and the previous manual booking workflow made it difficult for students to quickly identify available spaces, increased administrative workload, and made fair rule enforcement harder. UWI Study Spaces addresses this by providing real-time room visibility, policy-driven reservations, and role-based administrative control. 

## Objectives

The project was designed to:

- develop a web-based study room booking system for the Alma Jordan Library
- support student booking with enforced constraints such as booking limits and restrictions on consecutive slots
- implement role-based access control for students, administrators, and super administrators
- prevent overlapping bookings through booking conflict controls and validation

## Scope

The system is intended **only** for managing study rooms within the Alma Jordan Library. It does **not** support booking other university facilities, third-party reservation platforms, financial transactions, or physical access control systems. 
## Core Features

### Student Features
- authenticated access for UWI users
- browse and filter rooms by details such as building, capacity, and amenities
- view real-time room availability
- create and cancel bookings within configured rules
- join waitlists for unavailable slots
- manage personal bookings from a student dashboard 

### Admin Features
- manage rooms within assigned scope
- oversee bookings
- configure blackout windows, opening hours, and booking buffers
- monitor waitlists
- generate reports on usage and booking activity 

### Super Admin Features
- manage departments and users
- assign or revoke admin roles
- configure global booking policies
- access audit logs and system-wide reports 

## Functional Modules

The system is organized around the following major modules:

- Authentication, Signup, and User Profiles
- Roles, Permissions, and Admin Scope Enforcement
- Room Management
- Student Booking Control
- Waitlist
- Booking Creation and Booking Rules
- Reporting and Analytics
- Audit Logging
- Notifications
- System Settings 

## Technology Stack

The system uses:

- **Next.js** for the main web application framework
- **TypeScript** for maintainability and reduced errors
- **Supabase** for authentication, PostgreSQL database hosting, Row-Level Security, and backend services
- **Resend** for transactional email delivery
- **Vercel** for deployment
- **GitHub** for version control and collaborative development
- **Tailwind CSS** for interface styling
- **Node.js** for server-side execution and booking logic 

## System Roles

The platform supports three main user roles:

- **Students**: browse rooms, view availability, create and manage bookings
- **Admins**: manage rooms and bookings within assigned departments or room scope
- **Super Admins**: control users, departments, settings, logs, and system-wide access 

## Booking Rules and Controls

The system enforces configurable booking policies, including:

- booking limits
- advance booking windows
- time-slot restrictions
- blackout periods
- room capacity limits
- overlap prevention
- role-based control over booking actions 

## User Interface

The application includes interfaces and pages such as:

- landing pages
- login pages
- student dashboard
- browse rooms view
- schedule page
- my bookings page
- my waitlist page
- admin rooms panel
- admin bookings panel
- departments page
- users page
- waitlist page
- reports pages
- settings pages 

## Testing

The project documentation includes:

- unit testing
- dynamic testing across multiple modules
- integration testing
- user acceptance / black-box testing
- reporting on student sign-up success, browsing success, booking success, cancellation success, and overall experience 

## Beneficiary

The primary beneficiary is the **Alma Jordan Library**, specifically the staff responsible for coordinating and managing study room reservations. Primary end users are UWI students, while library personnel serve as secondary operational users.

