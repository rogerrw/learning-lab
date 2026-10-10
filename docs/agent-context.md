# Learning Lab — context for a new agent

Read this before writing code. It is the source of truth for the product designed so far. No application code exists yet.

## Where things stand

- Repo: `/Users/rogerwang/Projects/learning-lab`
- Git: local `main` only. Initial commit is `Start the Learning Lab repo.` There is no remote.
- Files already in the repo: `README.md`, `.gitignore`, and this document.
- The previous Cursor workspace, `flask-sandbox`, is a separate Flask reading-queue app. Leave it alone.
- Start at slice 1 below unless the user names a different slice.

## Product

Learning Lab is a classroom app.

- Teachers plan lessons, publish assignments, grade, and release feedback.
- Students see published plans, their assignment list, and released scores and comments.
- Administrators, later, manage people, the catalog, enrollments, and an audit log. The tables for that exist from the start. The screens do not.

## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, and shadcn/ui. Components live in `web/components/ui` and are added with the shadcn CLI from `web/`.
- Backend: Python and FastAPI
- Database: Postgres

FastAPI is the authorization boundary. Next.js renders view-specific responses and does not decide permissions. Student and teacher payloads are different models, even when they list the same assignment.

Repo layout, ORM, and migration tooling are not chosen yet. Pick ordinary defaults when implementing (Alembic, SQLAlchemy 2 or SQLModel, App Router) and keep the schema in this document.

## Locked model decisions

1. **The class is a section.** Lessons, enrollments, and assignments belong to `sections`. `courses` is the shared catalog entry, so two sections of one course can move at different speeds. UI copy can say "class". The table name is `sections`.
2. **Roles are placements.** `users` has no role column. `teacher` and `student` are `enrollments`. `org_admin` is an `org_memberships.role`. One account can teach a section and administer the org.
3. **Publish snapshots the roster.** Publishing an assignment inserts `assignment_recipients` for each active student enrollment. A student who enrolls later stays unassigned until a teacher adds a recipient. The assignment list, missing work, and gradebook read those rows.
4. **Release is its own moment.** A grade can be saved before students see it. Students see `points_earned` and student-audience comments when `grades.released_at` is set.

## Conventions

- Primary keys: `uuid`, `gen_random_uuid()`.
- Mutable tables: `created_at` and `updated_at` as `timestamptz`.
- Points: `numeric(8,2)`, never float.
- Status values: `text` plus a check constraint.
- Deletes: restrict when a row is referenced. Retire rows with status (`archived`, `withdrawn`, `disabled`, `closed`).
- Users are global. Tenancy starts at `org_memberships`. An enrollment requires a membership in the section's organization.
- `sections.org_id` must match the course and the term.
- Several teachers may enroll in one section. `assignments.created_by` is attribution, not extra authority.
- Permissions live in code for v1. Names below stay stable if custom roles later move into a `role_permissions` table.
- Write `audit_events` on publish, unpublish, release, unrelease, enrollment changes, and membership changes, even before an admin screen exists.

## Tables

### People

**users** — global person.

| Column | Type | Constraints |
| --- | --- | --- |
| email | citext | required, unique |
| display_name | text | required |
| password_hash | text | nullable; empty when sign-in is a provider |
| status | text | `active` or `disabled`. Disabled users cannot open a session |

**sessions** — cookie stores the raw token; Postgres stores the hash.

| Column | Type | Constraints |
| --- | --- | --- |
| user_id | uuid | required, fk users |
| token_hash | text | required, unique |
| expires_at | timestamptz | required |
| revoked_at | timestamptz | nullable |

**org_memberships** — the person belongs to the school. `member` may be enrolled. `org_admin` is the future administrator.

| Column | Type | Constraints |
| --- | --- | --- |
| org_id | uuid | required, fk organizations |
| user_id | uuid | required, fk users |
| role | text | `member` or `org_admin`. Unique `(org_id, user_id)` |

**enrollments** — classroom role.

| Column | Type | Constraints |
| --- | --- | --- |
| section_id | uuid | required, fk sections |
| user_id | uuid | required, fk users |
| role | text | `teacher` or `student` |
| status | text | `active` or `withdrawn`. Unique `(section_id, user_id)` |

Withdrawn students leave the gradebook and are left out of new recipient snapshots. Their submissions stay.

### Structure

**organizations** — the school and tenancy boundary. `name` text required. `slug` text required, unique.

**terms** — `org_id`, `name`, `starts_on` date, `ends_on` date on or after `starts_on`.

**courses** — catalog. `org_id`, `code` unique with `org_id`, `title`, nullable `subject`, nullable `description`.

**sections** — the class. `org_id`, `course_id`, `term_id`, `name` (for example "Period 2"), `status` `active` or `archived`.

### Lesson plan

Plans live on the section.

**units** — `section_id`, `title`, nullable `summary`, `position` unique with `section_id`.

**lessons**

| Column | Type | Constraints |
| --- | --- | --- |
| unit_id | uuid | required, fk units |
| title | text | required |
| position | int | required, unique with unit_id |
| objectives | text | nullable |
| student_body | text | nullable; student-facing |
| teacher_notes | text | nullable; teacher responses only |
| duration_minutes | int | nullable |
| scheduled_on | date | nullable |
| status | text | `draft` or `published` |

Student lesson responses include `student_body` for published lessons. `teacher_notes` is returned only to teachers of that section.

### Assignments

**assignments** — work posted to a section. `lesson_id` is optional.

| Column | Type | Constraints |
| --- | --- | --- |
| section_id | uuid | required, fk sections |
| lesson_id | uuid | nullable, fk lessons |
| created_by | uuid | required, fk users |
| title | text | required |
| instructions | text | nullable |
| kind | text | `assignment`, `practice`, or `project`. Practice may be 0 points |
| status | text | `draft`, `published`, or `closed` |
| points_possible | numeric(8,2) | required, >= 0 |
| due_at | timestamptz | nullable |
| published_at | timestamptz | nullable |

**assignment_recipients** — one row per student who was given the work.

| Column | Type | Constraints |
| --- | --- | --- |
| assignment_id | uuid | required, fk assignments |
| user_id | uuid | required, fk users |
| status | text | `assigned` or `excused`. Unique `(assignment_id, user_id)` |

### Grading

**rubrics** — optional, at most one per assignment (`assignment_id` unique).

**rubric_criteria** — `rubric_id`, `title`, nullable `description`, `points` >= 0, `position` unique with `rubric_id`. The app requires criterion points to sum to `assignments.points_possible`.

**submissions** — a student attempt. The first UI is a single attempt. `attempt` exists so a returned assignment can take attempt 2 without a migration. Unique `(assignment_id, user_id, attempt)`.

| Column | Type | Constraints |
| --- | --- | --- |
| assignment_id | uuid | required |
| user_id | uuid | required |
| attempt | int | required, >= 1, default 1 |
| body | text | nullable |
| status | text | `draft`, `submitted`, or `returned` |
| submitted_at | timestamptz | nullable |

Draft body is on the student API. Teachers see that a draft exists and read the body after submit.

**grades** — one current judgment per submission (`submission_id` unique).

| Column | Type | Constraints |
| --- | --- | --- |
| points_earned | numeric(8,2) | nullable, >= 0, <= points_possible |
| score_source | text | `manual`, `rubric`, or `override`. `rubric` means the total equals the criterion scores |
| grader_id | uuid | nullable, fk users |
| graded_at | timestamptz | nullable |
| released_at | timestamptz | nullable |

**criterion_scores** — `grade_id`, `criterion_id`, `points` within the criterion max, nullable `comment`. Unique `(grade_id, criterion_id)`.

**feedback_comments** — `submission_id`, `author_id`, `body`, `audience` `student` or `teacher`. Student-audience comments appear in the student payload after release. Teacher-audience comments stay on the grading screen.

### Files and audit

**attachments** — metadata only. Bytes live in object storage. `org_id`, `uploaded_by`, `storage_key`, `filename`, `content_type`, `byte_size` >= 0. Text assignments can ship before the upload UI.

**attachment_links** — `attachment_id`, `entity_type` (`lesson`, `assignment`, `submission`, `feedback_comment`), `entity_id`. The app checks that the target exists.

**audit_events** — append-only. `org_id`, nullable `actor_id`, `action`, `entity_type`, nullable `entity_id`, `metadata` jsonb default `{}`.

## Permissions

Checked in FastAPI against a section enrollment or an org membership. `org_admin` manages people, the catalog, sections, enrollments, and the audit log. Lesson notes, draft submission text, and grading stay with teachers of that section.

| Permission | Student | Teacher | Org admin |
| --- | --- | --- | --- |
| identity.self | Own account | Own account | Own account |
| member.read / member.manage | — | — | Organization |
| course.manage | — | — | Organization |
| section.read | Enrolled | Enrolled | Organization |
| section.manage | — | — | Organization |
| enrollment.read | Self | Section | Organization |
| enrollment.manage | — | — | Organization |
| lesson.read | Published body | Section, including notes | — |
| lesson.write | — | Section | — |
| assignment.read | Published and assigned | Section | — |
| assignment.write | — | Section | — |
| submission.read | Own, including drafts | Submitted and returned bodies | — |
| submission.write | Own | — | — |
| grade.read | Own, after release | Section | — |
| grade.write | — | Section | — |
| feedback.read | Own student-audience, after release | Section | — |
| feedback.write | — | Section | — |
| audit.read | — | — | Organization |

Section responses include the course title and term name. That is `section.read`, not a separate course permission.

## Screens

| Screen | Role | Reads |
| --- | --- | --- |
| Class home | Student or teacher | Active enrollments, with course title and term name |
| Lesson plan | Student | Published lessons and published assignments linked by `lesson_id` |
| Lesson plan | Teacher | Every unit and lesson, including drafts and `teacher_notes` |
| Assignment list | Student | Own recipient rows, latest attempt, grade when released |
| Assignment list | Teacher | Section assignments, including drafts, with counts by grading state |
| Gradebook | Teacher | Active student enrollments across published assignments |
| Grading | Teacher | One submission, rubric scores, both comment audiences |
| People, catalog, audit | Org admin | Memberships, courses, sections, enrollments, `audit_events`. Screens come later |

## Assignment list status

Do not store this. Derive it from the latest attempt and the grade. First match wins.

| Condition | Student label | Teacher label |
| --- | --- | --- |
| Recipient is excused | Excused | Excused |
| Latest attempt is returned | Returned | Returned |
| Latest attempt is a draft | Draft | In progress |
| Grade has `released_at` | Score | Released |
| Grade is saved and unreleased | Submitted | Needs release |
| Submitted, no grade yet | Submitted | Needs grade |
| No submission, and `due_at` is past | Missing | Missing |
| No submission yet | Not started | Not started |

The teacher list's grading queue is the sum of Needs grade and Needs release.

## Lifecycles

- **draft → published:** set `published_at` and insert a recipient for each active student.
- **published → draft:** allowed only when there are no submissions. Remove recipient rows.
- **published → closed:** reject new submissions. Grading and release continue. A closed assignment may be published again.
- **draft → submitted:** set `submitted_at`. Closed assignments reject the write.
- **submitted → returned:** the student may start `attempt + 1`. The earlier attempt and its grade stay.
- **saved → released:** set `released_at`.
- **released → saved:** clear `released_at`. Both release transitions write an audit event.

## Left out of the first schema

| Later | Hook already specified |
| --- | --- |
| Single sign-on | `users.password_hash` stays nullable |
| Custom roles | Permission names above, then `role_permissions` |
| Late student added to old work | Insert an `assignment_recipient` |
| Resubmit after feedback | `submissions.attempt` |
| File upload UI | `attachments` and `attachment_links` |
| Administrator screens | `org_memberships.role = org_admin` and `audit_events` |
| Guardians, attendance, discussions | New tables when those products exist |
| Weighted categories and a course grade | New rollup; assignment scores stay as they are |
| Quizzes and item banks | New kind plus items. Kind stays assignment, practice, or project until then |

## Build slices

1. **Sign-in.** `organizations`, `users`, `sessions`, `org_memberships`. Seed one org, one user, one `org_admin` membership.
2. **Classes.** `terms`, `courses`, `sections`, `enrollments`.
3. **Lesson plan.** `units`, `lessons`.
4. **Assignment list.** `assignments`, `assignment_recipients`.
5. **Grading.** `submissions`, `rubrics`, `rubric_criteria`, `grades`, `criterion_scores`, `feedback_comments`.
6. **Files and audit UI.** `attachments`, `attachment_links`, `audit_events`. Write audit rows from slice 4 onward; the reader UI is slice 6.

The administrator UI can be built on slices 1, 2, and 6 whenever it is needed, with no new identity tables.
