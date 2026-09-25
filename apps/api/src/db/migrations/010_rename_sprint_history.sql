ALTER TABLE sprint_history RENAME TO iteration_history;
ALTER TABLE iteration_history RENAME COLUMN sprint_id TO iteration_id;
