-- db/migrations/031_create_followers_and_preferences.sql

-- Work item followers table
CREATE TABLE IF NOT EXISTS work_item_followers (
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (work_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_work_item_followers_user ON work_item_followers(user_id);

-- User notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  channel_in_app BOOLEAN DEFAULT true,
  channel_email BOOLEAN DEFAULT true,
  notify_mentions BOOLEAN DEFAULT true,
  notify_assigned BOOLEAN DEFAULT true,
  notify_followed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
