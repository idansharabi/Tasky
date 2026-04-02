-- ============================================================
-- Tasky – Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL editor)
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('parent', 'kid')),
  avatar_color  TEXT NOT NULL DEFAULT '#6366f1',
  avatar_emoji  TEXT NOT NULL DEFAULT '😊',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Task template bank (parent-managed, reusable)
CREATE TABLE IF NOT EXISTS task_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  credit_value  INTEGER NOT NULL DEFAULT 10,
  icon          TEXT NOT NULL DEFAULT '⭐',
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Task assignments (scheduled tasks per kid per day)
CREATE TABLE IF NOT EXISTS task_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  kid_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  credit_value    INTEGER NOT NULL,
  icon            TEXT NOT NULL DEFAULT '⭐',
  due_date        DATE NOT NULL,
  is_recurring    BOOLEAN DEFAULT FALSE,
  recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'weekdays')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Task submissions (photo + AI verdict)
CREATE TABLE IF NOT EXISTS task_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  photo_url       TEXT,
  ai_approved     BOOLEAN,
  ai_confidence   TEXT,
  ai_reasoning    TEXT,
  parent_override BOOLEAN,
  submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Credit ledger (immutable audit trail)
CREATE TABLE IF NOT EXISTS credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,
  description     TEXT NOT NULL,
  assignment_id   UUID REFERENCES task_assignments(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles (needed to see kid names),
-- but only write their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Task templates: parents can CRUD their own; kids can read all
CREATE POLICY "templates_select" ON task_templates FOR SELECT USING (true);
CREATE POLICY "templates_insert" ON task_templates FOR INSERT WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
);
CREATE POLICY "templates_update" ON task_templates FOR UPDATE USING (
  auth.uid() = created_by
);
CREATE POLICY "templates_delete" ON task_templates FOR DELETE USING (
  auth.uid() = created_by
);

-- Task assignments: parents can CRUD; kids can read their own + update status
CREATE POLICY "assignments_select" ON task_assignments FOR SELECT USING (
  auth.uid() = kid_id OR auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
);
CREATE POLICY "assignments_insert" ON task_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
);
CREATE POLICY "assignments_update" ON task_assignments FOR UPDATE USING (
  auth.uid() = created_by OR auth.uid() = kid_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
);
CREATE POLICY "assignments_delete" ON task_assignments FOR DELETE USING (
  auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
);

-- Submissions: kid submits their own; parents can read all + update
CREATE POLICY "submissions_select" ON task_submissions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    WHERE ta.id = assignment_id AND (ta.kid_id = auth.uid() OR ta.created_by = auth.uid())
  ) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
);
CREATE POLICY "submissions_insert" ON task_submissions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    WHERE ta.id = assignment_id AND ta.kid_id = auth.uid()
  )
);
CREATE POLICY "submissions_update" ON task_submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
);

-- Credit ledger: kids read their own; parents read all + insert
CREATE POLICY "ledger_select" ON credit_ledger FOR SELECT USING (
  auth.uid() = kid_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
);
CREATE POLICY "ledger_insert" ON credit_ledger FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent') OR
  auth.uid() = created_by
);

-- Push subscriptions: own records only
CREATE POLICY "push_own" ON push_subscriptions USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for task photos
-- ============================================================
-- Run in Supabase Dashboard → Storage → Create bucket named "task-photos"
-- Set it to Public

-- ============================================================
-- Helper view: kid balances
-- ============================================================
CREATE OR REPLACE VIEW kid_balances AS
  SELECT
    p.id,
    p.name,
    p.avatar_color,
    p.avatar_emoji,
    COALESCE(SUM(cl.amount), 0)::INTEGER AS balance
  FROM profiles p
  LEFT JOIN credit_ledger cl ON cl.kid_id = p.id
  WHERE p.role = 'kid'
  GROUP BY p.id, p.name, p.avatar_color, p.avatar_emoji;
