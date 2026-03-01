-- Drop the old restrictive select policy since the new permissive one covers leaderboard needs
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
