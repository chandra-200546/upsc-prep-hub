-- Create table to cache daily current affairs
CREATE TABLE public.daily_current_affairs_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  affairs JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to cache daily intel reports
CREATE TABLE public.daily_intel_report_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  report JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_current_affairs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_intel_report_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read cached data
CREATE POLICY "Authenticated users can read current affairs cache" 
ON public.daily_current_affairs_cache 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read intel report cache" 
ON public.daily_intel_report_cache 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow service role to insert/update (for edge functions)
CREATE POLICY "Service role can manage current affairs cache" 
ON public.daily_current_affairs_cache 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage intel report cache" 
ON public.daily_intel_report_cache 
FOR ALL 
USING (auth.role() = 'service_role');

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;