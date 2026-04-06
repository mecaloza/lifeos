-- Fitness module schema for LifeOS
-- Sync to Supabase is authenticated. Anonymous usage falls back to local device storage.

CREATE OR REPLACE FUNCTION fitness_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fitness_require_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required for synced fitness data';
  END IF;

  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;

  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'user_id must match auth.uid()';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_task_user_id_if_authenticated()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS fitness_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL CHECK (metric_key IN ('wake_up', 'gym_strength', 'bjj', 'weight_checkin')),
  target_count INTEGER NOT NULL DEFAULT 0 CHECK (target_count >= 0),
  target_time TIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS fitness_habit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL DEFAULT 'wake_up' CHECK (metric_key IN ('wake_up')),
  logged_on DATE NOT NULL,
  actual_time TIME,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS fitness_body_metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_on DATE NOT NULL,
  weight_value NUMERIC(8,2) NOT NULL CHECK (weight_value > 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS fitness_training_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_session_id BIGINT REFERENCES fitness_training_sessions(id) ON DELETE SET NULL,
  calendar_task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('gym_strength', 'bjj')),
  session_title TEXT,
  session_date DATE NOT NULL,
  scheduled_for TIMESTAMP WITHOUT TIME ZONE,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'missed')),
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_template TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_fitness_goals_user_id ON fitness_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_goals_metric_key ON fitness_goals(metric_key);
CREATE INDEX IF NOT EXISTS idx_fitness_habit_logs_user_id_logged_on ON fitness_habit_logs(user_id, logged_on DESC);
CREATE INDEX IF NOT EXISTS idx_fitness_habit_logs_metric_key ON fitness_habit_logs(metric_key);
CREATE INDEX IF NOT EXISTS idx_fitness_body_metrics_user_id_measured_on ON fitness_body_metrics(user_id, measured_on DESC);
CREATE INDEX IF NOT EXISTS idx_fitness_training_sessions_user_id_session_date ON fitness_training_sessions(user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_fitness_training_sessions_status ON fitness_training_sessions(status);
CREATE INDEX IF NOT EXISTS idx_fitness_training_sessions_calendar_task_id ON fitness_training_sessions(calendar_task_id);
CREATE INDEX IF NOT EXISTS idx_fitness_training_sessions_source_session_id ON fitness_training_sessions(source_session_id);

ALTER TABLE fitness_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_training_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their own fitness goals" ON fitness_goals;
CREATE POLICY "Users can access their own fitness goals" ON fitness_goals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their own fitness habit logs" ON fitness_habit_logs;
CREATE POLICY "Users can access their own fitness habit logs" ON fitness_habit_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their own fitness body metrics" ON fitness_body_metrics;
CREATE POLICY "Users can access their own fitness body metrics" ON fitness_body_metrics
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their own fitness training sessions" ON fitness_training_sessions;
CREATE POLICY "Users can access their own fitness training sessions" ON fitness_training_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow all task operations" ON tasks;
DROP POLICY IF EXISTS "Users can only access their own tasks" ON tasks;
CREATE POLICY "Authenticated users can access their own tasks" ON tasks
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Anonymous users can access unowned tasks" ON tasks
  FOR ALL
  USING (auth.uid() IS NULL AND user_id IS NULL)
  WITH CHECK (auth.uid() IS NULL AND user_id IS NULL);

DROP TRIGGER IF EXISTS fitness_goals_require_user_id ON fitness_goals;
CREATE TRIGGER fitness_goals_require_user_id
  BEFORE INSERT OR UPDATE ON fitness_goals
  FOR EACH ROW
  EXECUTE FUNCTION fitness_require_user_id();

DROP TRIGGER IF EXISTS fitness_habit_logs_require_user_id ON fitness_habit_logs;
CREATE TRIGGER fitness_habit_logs_require_user_id
  BEFORE INSERT OR UPDATE ON fitness_habit_logs
  FOR EACH ROW
  EXECUTE FUNCTION fitness_require_user_id();

DROP TRIGGER IF EXISTS fitness_body_metrics_require_user_id ON fitness_body_metrics;
CREATE TRIGGER fitness_body_metrics_require_user_id
  BEFORE INSERT OR UPDATE ON fitness_body_metrics
  FOR EACH ROW
  EXECUTE FUNCTION fitness_require_user_id();

DROP TRIGGER IF EXISTS fitness_training_sessions_require_user_id ON fitness_training_sessions;
CREATE TRIGGER fitness_training_sessions_require_user_id
  BEFORE INSERT OR UPDATE ON fitness_training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION fitness_require_user_id();

DROP TRIGGER IF EXISTS set_user_id_tasks ON tasks;
CREATE TRIGGER set_user_id_tasks
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_task_user_id_if_authenticated();

DROP TRIGGER IF EXISTS fitness_goals_set_updated_at ON fitness_goals;
CREATE TRIGGER fitness_goals_set_updated_at
  BEFORE UPDATE ON fitness_goals
  FOR EACH ROW
  EXECUTE FUNCTION fitness_set_updated_at();

DROP TRIGGER IF EXISTS fitness_habit_logs_set_updated_at ON fitness_habit_logs;
CREATE TRIGGER fitness_habit_logs_set_updated_at
  BEFORE UPDATE ON fitness_habit_logs
  FOR EACH ROW
  EXECUTE FUNCTION fitness_set_updated_at();

DROP TRIGGER IF EXISTS fitness_body_metrics_set_updated_at ON fitness_body_metrics;
CREATE TRIGGER fitness_body_metrics_set_updated_at
  BEFORE UPDATE ON fitness_body_metrics
  FOR EACH ROW
  EXECUTE FUNCTION fitness_set_updated_at();

DROP TRIGGER IF EXISTS fitness_training_sessions_set_updated_at ON fitness_training_sessions;
CREATE TRIGGER fitness_training_sessions_set_updated_at
  BEFORE UPDATE ON fitness_training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION fitness_set_updated_at();
