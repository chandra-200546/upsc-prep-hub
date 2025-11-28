-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_year INTEGER NOT NULL,
  optional_subject TEXT,
  study_hours_per_day INTEGER DEFAULT 4,
  language TEXT DEFAULT 'English',
  profile_photo_url TEXT,
  mentor_personality TEXT DEFAULT 'friendly' CHECK (mentor_personality IN ('friendly', 'strict', 'topper', 'military', 'humorous', 'spiritual')),
  current_streak INTEGER DEFAULT 0,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create prelims_questions table
CREATE TABLE public.prelims_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  subject TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'extreme')),
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create prelims_attempts table
CREATE TABLE public.prelims_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.prelims_questions(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create current_affairs table
CREATE TABLE public.current_affairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_content TEXT,
  category TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  tags TEXT[],
  importance_level TEXT DEFAULT 'medium' CHECK (importance_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat_messages table for AI mentor and assistant
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_type TEXT NOT NULL CHECK (chat_type IN ('mentor', 'assistant')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create study_plan table
CREATE TABLE public.study_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_tasks INTEGER DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create gamification_badges table
CREATE TABLE public.gamification_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prelims_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prelims_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_affairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for prelims_questions (public read)
CREATE POLICY "Anyone can view questions"
  ON public.prelims_questions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for prelims_attempts
CREATE POLICY "Users can view their own attempts"
  ON public.prelims_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts"
  ON public.prelims_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for current_affairs (public read)
CREATE POLICY "Anyone can view current affairs"
  ON public.current_affairs FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view their own messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for study_plan
CREATE POLICY "Users can view their own study plan"
  ON public.study_plan FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own study plan"
  ON public.study_plan FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study plan"
  ON public.study_plan FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for gamification_badges
CREATE POLICY "Users can view their own badges"
  ON public.gamification_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges"
  ON public.gamification_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample prelims questions
INSERT INTO public.prelims_questions (question, option_a, option_b, option_c, option_d, correct_answer, subject, topic, difficulty, explanation) VALUES
('What is the capital of India?', 'Mumbai', 'Delhi', 'Kolkata', 'Chennai', 'B', 'General Knowledge', 'Geography', 'easy', 'Delhi is the capital of India and serves as the seat of the Government of India.'),
('Who was the first Prime Minister of India?', 'Mahatma Gandhi', 'Jawaharlal Nehru', 'Sardar Patel', 'Dr. Rajendra Prasad', 'B', 'History', 'Modern India', 'easy', 'Jawaharlal Nehru was the first Prime Minister of India, serving from 1947 to 1964.'),
('Which article of the Constitution deals with the Right to Equality?', 'Article 12', 'Article 14', 'Article 19', 'Article 21', 'B', 'Polity', 'Fundamental Rights', 'medium', 'Article 14 guarantees equality before law and equal protection of laws within the territory of India.');

-- Insert sample current affairs
INSERT INTO public.current_affairs (title, summary, category, importance_level, tags) VALUES
('Budget 2024 Highlights', 'The Union Budget 2024 focused on infrastructure development, healthcare, and education sectors with significant allocations.', 'Economy', 'high', ARRAY['Budget', 'Economy', 'Policy']),
('New Environmental Policy', 'Government announces new environmental protection measures to combat climate change and promote sustainable development.', 'Environment', 'high', ARRAY['Environment', 'Policy', 'Climate Change']);