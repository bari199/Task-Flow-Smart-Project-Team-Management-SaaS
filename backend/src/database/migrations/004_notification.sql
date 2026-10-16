ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS event_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS
  notifications_event_id_unique
ON notifications (event_id)
WHERE event_id IS NOT NULL;