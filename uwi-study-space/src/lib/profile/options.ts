// src/lib/profile/options.ts
export const FACULTY_OPTIONS = [
  "Engineering",
  "Food & Agriculture",
  "Humanities & Education",
  "Medical Sciences",
  "Social Sciences",
  "Science & Technology",
  "Law",
  "Sport",
] as const;

export const ACADEMIC_STATUS_OPTIONS = ["UG", "PG", "Other"] as const;

export type FacultyOption = (typeof FACULTY_OPTIONS)[number];
export type AcademicStatusOption = (typeof ACADEMIC_STATUS_OPTIONS)[number];