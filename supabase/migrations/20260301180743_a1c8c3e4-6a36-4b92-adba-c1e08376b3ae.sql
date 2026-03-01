-- Allow all authenticated users to see profiles for leaderboard (name, total_xp, level)
CREATE POLICY "Authenticated users can view all profiles for leaderboard"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
