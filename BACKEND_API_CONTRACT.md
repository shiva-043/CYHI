# Campus Companion backend contract

The frontend uses cookie/session authentication by sending requests with
`credentials: "include"`. The backend is the final authority for identity,
roles, targeting, and permissions. Never authorize a request from a role value
sent by the browser.

## Roles and authorization

- `Student` may read their own profile, targeted announcements, and targeted timetable.
- `CR` and `Professor` may also create, update, and delete announcements and timetable entries.
- Every protected endpoint must obtain the current user and role from the verified server session or token.
- Return `401 Unauthorized` when authentication is missing or invalid.
- Return `403 Forbidden` when an authenticated Student calls a management endpoint.

Protected management endpoints:

- `POST /api/announcements`
- `PUT /api/announcements/:id`
- `DELETE /api/announcements/:id`
- `POST /api/timetable`
- `PUT /api/timetable/:id`
- `DELETE /api/timetable/:id`

## Read endpoints and server-side targeting

- `GET /api/user/profile` returns the authenticated user, including `role`, `branch`, `semester`, and `section`.
- `GET /api/announcements` returns only announcements that apply to the authenticated user's semester, branch, and section. Apply `ALL` as a wildcard on the server.
- `GET /api/timetable/today` returns only today's entries for the authenticated user's semester, branch, and section.
- `GET /api/branches` may return additional branch codes for the management forms.

Do not send every batch's announcements or timetable to a Student and filter it in browser JavaScript.

## Announcement records

The frontend sends these fields when creating or updating an announcement:

```json
{
  "title": "DBMS Assignment",
  "description": "Submit Assignment 2 by 13 September, 11:59 PM.",
  "category": "Urgent",
  "targetSemester": 3,
  "targetBranch": "CSE",
  "targetSection": "A",
  "deadline": "2026-09-13T23:59",
  "buttonText": "View Details",
  "actionUrl": ""
}
```

Store announcement fields equivalent to:

`id`, `title`, `description`, `category`, `target_semester`,
`target_branch`, `target_section`, `deadline`, `button_text`, `action_url`,
`created_by`, `created_at`, and `updated_at`.

`created_by` must reference a user. Record the authenticated creator on the
server rather than accepting `created_by` from the frontend.

## Timetable records

The frontend sends these fields when creating or updating a timetable entry:

```json
{
  "subject": "DBMS",
  "room": "C204",
  "date": "2026-09-12",
  "startTime": "2026-09-12T10:00:00",
  "endTime": "2026-09-12T11:00:00",
  "type": "class",
  "targetSemester": 3,
  "targetBranch": "CSE",
  "targetSection": "A"
}
```

Store timetable fields equivalent to:

`id`, `subject`, `room`, `date`, `start_time`, `end_time`, `type`,
`target_semester`, `target_branch`, `target_section`, `created_by`,
`created_at`, and `updated_at`.

Validate on the server that `type` is `class`, `break`, or `free`, that the end
time is after the start time, and that all target values are allowed. The
`created_by` field must reference the authenticated CR or Professor.

## Deadline email reminders

The existing frontend reminder button calls `POST /api/announcement-reminders`
with an `announcementId`. The backend should verify that the announcement is
visible to the current user, use the authenticated user's verified email, and
schedule the email using a server-side job queue or scheduler. Email delivery
cannot run reliably from a static browser page.
