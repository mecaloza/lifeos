-- Repeatable parity fixture for the Fitness module
-- Loads the current Monday-Sunday week for the first available authenticated user.
-- If no auth user exists in the target DB, this script inserts no fitness rows.

WITH fixture_user AS (
  SELECT id AS user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
), fixture_week AS (
  SELECT date_trunc('week', CURRENT_DATE)::date AS monday
), cleared_tasks AS (
  DELETE FROM tasks
  WHERE title LIKE 'Fitness Fixture:%'
    AND user_id IN (SELECT user_id FROM fixture_user)
  RETURNING id
), cleared_sessions AS (
  DELETE FROM fitness_training_sessions
  WHERE note = 'fitness-fixture'
    AND user_id IN (SELECT user_id FROM fixture_user)
  RETURNING id
), cleared_metrics AS (
  DELETE FROM fitness_body_metrics
  WHERE note = 'fitness-fixture'
    AND user_id IN (SELECT user_id FROM fixture_user)
  RETURNING id
), cleared_habits AS (
  DELETE FROM fitness_habit_logs
  WHERE note = 'fitness-fixture'
    AND user_id IN (SELECT user_id FROM fixture_user)
  RETURNING id
), cleared_goals AS (
  DELETE FROM fitness_goals
  WHERE metric_key IN ('wake_up', 'gym_strength', 'bjj', 'weight_checkin')
    AND user_id IN (SELECT user_id FROM fixture_user)
  RETURNING id
)
INSERT INTO fitness_goals (user_id, metric_key, target_count, target_time, is_active)
SELECT user_id, 'wake_up', 5, '05:00:00', true FROM fixture_user
UNION ALL
SELECT user_id, 'gym_strength', 4, NULL, true FROM fixture_user
UNION ALL
SELECT user_id, 'bjj', 4, NULL, true FROM fixture_user
UNION ALL
SELECT user_id, 'weight_checkin', 5, NULL, true FROM fixture_user;

WITH fixture_user AS (
  SELECT id AS user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
), fixture_week AS (
  SELECT date_trunc('week', CURRENT_DATE)::date AS monday
)
INSERT INTO fitness_habit_logs (user_id, metric_key, logged_on, actual_time, success, note)
SELECT user_id, 'wake_up', monday + 0, '04:48:00', true, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, 'wake_up', monday + 1, '05:06:00', false, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, 'wake_up', monday + 2, '04:58:00', true, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, 'wake_up', monday + 3, '04:54:00', true, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, 'wake_up', monday + 4, '05:02:00', false, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, 'wake_up', monday + 5, '04:50:00', true, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, 'wake_up', monday + 6, '04:42:00', true, 'fitness-fixture' FROM fixture_user, fixture_week;

WITH fixture_user AS (
  SELECT id AS user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
), fixture_week AS (
  SELECT date_trunc('week', CURRENT_DATE)::date AS monday
)
INSERT INTO fitness_body_metrics (user_id, measured_on, weight_value, note)
SELECT user_id, monday + 0, 82.5, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, monday + 1, 82.2, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, monday + 3, 81.9, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, monday + 5, 81.7, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, monday + 6, 81.6, 'fitness-fixture' FROM fixture_user, fixture_week;

WITH fixture_user AS (
  SELECT id AS user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
), fixture_week AS (
  SELECT date_trunc('week', CURRENT_DATE)::date AS monday
), fallback_task AS (
  INSERT INTO tasks (
    user_id,
    title,
    description,
    tags,
    completed,
    status,
    priority,
    start_time,
    duration_minutes,
    is_scheduled,
    created_at,
    updated_at
  )
  SELECT
    user_id,
    'Fitness Fixture: Fallback Gym Session',
    'Auto-created fallback session for fixture parity checks',
    ARRAY['Fitness', 'Fallback', 'Gym'],
    false,
    'todo',
    'medium',
    (monday + 1)::timestamp + TIME '18:00:00',
    60,
    true,
    TIMEZONE('utc', NOW()),
    TIMEZONE('utc', NOW())
  FROM fixture_user, fixture_week
  RETURNING id
)
INSERT INTO fitness_training_sessions (
  user_id,
  source_session_id,
  calendar_task_id,
  session_type,
  session_title,
  session_date,
  scheduled_for,
  duration_minutes,
  status,
  is_fallback,
  fallback_template,
  note
)
SELECT user_id, NULL, NULL, 'gym_strength', 'Monday Strength', monday + 0, (monday + 0)::timestamp + TIME '05:30:00', 75, 'completed', false, NULL, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, NULL, NULL, 'gym_strength', 'Tuesday Strength', monday + 1, (monday + 1)::timestamp + TIME '05:30:00', 75, 'missed', false, NULL, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, NULL, NULL, 'gym_strength', 'Thursday Strength', monday + 3, (monday + 3)::timestamp + TIME '05:30:00', 75, 'completed', false, NULL, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, NULL, NULL, 'gym_strength', 'Saturday Strength', monday + 5, (monday + 5)::timestamp + TIME '07:00:00', 75, 'completed', false, NULL, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, NULL, fallback_task.id, 'gym_strength', 'Tuesday Fallback Strength', monday + 1, (monday + 1)::timestamp + TIME '18:00:00', 60, 'completed', true, 'after_work_reset', 'fitness-fixture' FROM fixture_user, fixture_week, fallback_task
UNION ALL
SELECT user_id, NULL, NULL, 'bjj', 'Monday BJJ', monday + 0, (monday + 0)::timestamp + TIME '19:00:00', 90, 'completed', false, NULL, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, NULL, NULL, 'bjj', 'Wednesday BJJ', monday + 2, (monday + 2)::timestamp + TIME '19:00:00', 90, 'completed', false, NULL, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, NULL, NULL, 'bjj', 'Friday BJJ', monday + 4, (monday + 4)::timestamp + TIME '19:00:00', 90, 'completed', false, NULL, 'fitness-fixture' FROM fixture_user, fixture_week
UNION ALL
SELECT user_id, NULL, NULL, 'bjj', 'Sunday BJJ', monday + 6, (monday + 6)::timestamp + TIME '10:00:00', 90, 'completed', false, NULL, 'fitness-fixture' FROM fixture_user, fixture_week;
