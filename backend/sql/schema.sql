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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_staff_time ON bookings(staff_id, start_time);
CREATE INDEX IF NOT EXISTS idx_availability_staff ON availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

-- Optional seed data (comment out if not wanted)
-- INSERT INTO staff (name, email, role, department) VALUES
--   ('Alice Johnson', 'alice@example.com', 'Therapist', 'Wellness'),
--   ('Bob Smith', 'bob@example.com', 'Consultant', 'Business');
