-- Generalized Staff Booking & Scheduling Application
-- Run this with: psql -U scheduler -d scheduler -f backend/sql/schema.sql
-- Or from project root after setting up DB: psql $DATABASE_URL -f backend/sql/schema.sql

-- Enable extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(100),
  department VARCHAR(100),
  phone VARCHAR(50),
  notes TEXT,
  password TEXT, -- for trainer auth demo (hashed with bcrypt)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Availability (recurring weekly availability or specific blocks)
-- day_of_week: 0=Sunday ... 6=Saturday, or use NULL for one-off date ranges
CREATE TABLE IF NOT EXISTS availability (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  day_of_week INTEGER, -- 0-6 for recurring weekly, NULL for specific
  specific_date DATE,  -- for one-time availability overrides
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookings / Appointments
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'confirmed', -- pending, confirmed, cancelled, completed
  service_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_staff_time ON bookings(staff_id, start_time);
CREATE INDEX IF NOT EXISTS idx_availability_staff ON availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- Migration for soft-delete column (safe on existing DBs that predate cancelled_at)
ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- Optional seed data (uncomment / re-run as needed for fresh DBs)
-- Demo staff matching README credentials (passwords hashed separately via script)
INSERT INTO staff (name, email, role, department) VALUES
  ('Alice Chen', 'alice.chen@example.com', 'trainer', 'Meditation'),
  ('Marcus Rivera', 'marcus.rivera@example.com', 'trainer', 'Wellness'),
  ('Priya Patel', 'priya.patel@example.com', 'trainer', 'Counseling'),
  ('Jordan Admin', 'admin@example.com', 'admin', 'Operations')
ON CONFLICT (email) DO NOTHING;

-- Normalize legacy role values on existing databases
UPDATE staff SET role = 'trainer' WHERE LOWER(role) = 'trainer' AND role != 'trainer';
UPDATE staff SET role = 'admin' WHERE LOWER(role) = 'admin' AND role != 'admin';

-- Example soft-cancelled booking (for demonstrating Cancelled History in dashboard)
INSERT INTO bookings (staff_id, start_time, end_time, client_name, client_email, client_phone, status, service_type, notes, cancelled_at, created_at, updated_at)
SELECT 
  (SELECT id FROM staff WHERE email = 'alice.chen@example.com' LIMIT 1),
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days' + INTERVAL '1 hour',
  'Sample Cancelled Client',
  'cancelled@example.com',
  NULL,
  'cancelled',
  'Intro Sitting',
  'Example of a soft-deleted (cancelled) booking for history view',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '2 days'
WHERE (SELECT id FROM staff WHERE email = 'alice.chen@example.com' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM bookings WHERE client_email = 'cancelled@example.com' AND status = 'cancelled'
  );
