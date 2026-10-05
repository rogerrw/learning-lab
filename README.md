# Learning Lab

Classroom app for teachers and students. An administrator view comes later, on the same data.

## Stack

- Frontend: Next.js and TypeScript
- Backend: Python and FastAPI
- Database: Postgres

## Model

The class is a section. A course is the shared catalog entry.

Roles are placements. `teacher` and `student` are enrollments. `org_admin` is an organization membership. A user account has no role column.

Publishing an assignment snapshots the roster into recipient rows. Grading and release are separate: students see a score when the grade is released.

## First slices

1. Sign-in and organization membership
2. Terms, courses, sections, and enrollments
3. Lesson plan
4. Assignment list
5. Submissions, grading, and feedback
6. Files and the audit log
