## Users

- **Represents**: an authenticated person using Shadow
- **Key columns**:
  - `user_id` (PK)
  - `email` / `username`
  - `display_name`
  - `created_at`, `last_login_at`

## Tasks

- **Represents**: one coding‑agent session (a “task”)
- **Key columns**:
  - `task_id` (PK)
  - `user_id` (FK → Users)
  - `repo_url`, `branch`
  - `model_name` (e.g. “Claude v4”)
  - `status` (enum: pending, running, completed, error)
  - `created_at`, `started_at`, `completed_at`
  - optional `error_message`

## ChatMessages

- **Represents**: each completed LLM or user message in the chat history
- **Key columns**:
  - `message_id` (PK)
  - `task_id` (FK → Tasks)
  - `sender` (enum: user, agent)
  - `content` (text blob)
  - `created_at`
- **Notes**: write one row per fully‑streamed message

## TaskCommands (optional)

- **Represents**: individual shell or tool commands run by the agent
- **Key columns**:
  - `command_id` (PK)
  - `task_id` (FK → Tasks)
  - `command_text`
  - `exit_code`
  - `output` (text)
  - `created_at`

## FileEdits (optional)

- **Represents**: file‑edit operations the agent performed
- **Key columns**:
  - `edit_id` (PK)
  - `task_id` (FK → Tasks)
  - `file_path`
  - `diff` (unified‑diff text)
  - `created_at`

## Artifacts

- **Represents**: any build outputs, logs, or archives uploaded after task completion
- **Key columns**:
  - `artifact_id` (PK)
  - `task_id` (FK → Tasks)
  - `type` (enum: log, binary, zip, report, etc.)
  - `s3_url`
  - `created_at`

---

### Relationships & Indexes

- **Users → Tasks**: one‑to‑many (index on `Tasks.user_id`)
- **Tasks → ChatMessages**: one‑to‑many (index on `ChatMessages.task_id`)
- **Tasks → TaskCommands / FileEdits / Artifacts**: each is one‑to‑many
- **Timestamps**: index on `created_at` for efficient history lookup

With this outline in place, you can write the actual CREATE TABLE statements and add any constraints or indexes you need (e.g. unique task IDs, foreign‑key cascades, full‑text indexes on `content`, etc.). Let me know when you’re ready for the SQL!
::contentReference[oaicite:0]{index=0}
