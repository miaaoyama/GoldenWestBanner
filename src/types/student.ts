// src/types/student.ts
// Shared type for student profile data passed from the page → banner → API.

export interface StudentProfile {
  /** e.g. "Computer Science", "Nursing", "Business Administration" */
  major: string;
  /** e.g. "Freshman", "Sophomore", "Junior", "Senior" */
  year: string;
  /** e.g. "Full-Time", "Part-Time" */
  status: string;
}
