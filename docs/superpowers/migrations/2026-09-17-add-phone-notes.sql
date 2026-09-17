-- docs/superpowers/migrations/2026-09-17-add-phone-notes.sql
-- Run once in Supabase SQL Editor

ALTER TABLE members ADD COLUMN phone TEXT;
ALTER TABLE members ADD COLUMN notes TEXT;