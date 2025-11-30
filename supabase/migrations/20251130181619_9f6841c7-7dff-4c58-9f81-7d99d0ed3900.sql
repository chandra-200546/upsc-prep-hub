-- Create mains_questions table for daily AI-generated questions
CREATE TABLE public.mains_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_text TEXT NOT NULL,
  category TEXT NOT NULL,
  word_limit INTEGER NOT NULL DEFAULT 250,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster date-based queries
CREATE INDEX idx_mains_questions_date ON public.mains_questions(date);

-- Create mains_submissions table to store user submissions
CREATE TABLE public.mains_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID REFERENCES public.mains_questions(id),
  answer_text TEXT,
  answer_image_url TEXT,
  evaluation TEXT,
  marks INTEGER,
  word_count INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.mains_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mains_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mains_questions (public read)
CREATE POLICY "Anyone can view mains questions"
ON public.mains_questions
FOR SELECT
USING (true);

-- RLS Policies for mains_submissions (user-specific)
CREATE POLICY "Users can view their own submissions"
ON public.mains_submissions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own submissions"
ON public.mains_submissions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions"
ON public.mains_submissions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create storage bucket for answer images
INSERT INTO storage.buckets (id, name, public)
VALUES ('mains-answers', 'mains-answers', true);

-- Storage policies for mains-answers bucket
CREATE POLICY "Users can view answer images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'mains-answers');

CREATE POLICY "Users can upload their answer images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'mains-answers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their answer images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'mains-answers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);