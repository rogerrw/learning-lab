# Learning Lab

Classroom app for teachers and students. An administrator view comes later, on the same data.

Agents continuing this project should read [docs/agent-context.md](docs/agent-context.md) first. That file is the model and the build order. Slice 1 (sign-in) is implemented. Classes are next.

## Run locally

```bash
docker compose up -d
cp .env.example .env
cd api && uv sync && uv run alembic upgrade head && uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
```

In another shell:

```bash
cd web && npm install && npm run dev
```

Open http://localhost:3000 and sign in as `admin@learninglab.test` / `learning-lab-dev`.

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
