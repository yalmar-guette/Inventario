-- Script to add auto-sync columns to system_config table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.system_config 
ADD COLUMN IF NOT EXISTS auto_sync_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS last_sync_date DATE;

-- Verify columns were added 
-- SELECT * FROM public.system_config;
