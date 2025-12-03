-- Create mind_maps table for saving generated mind maps
CREATE TABLE public.mind_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mind_maps ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own mind maps" 
ON public.mind_maps 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mind maps" 
ON public.mind_maps 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mind maps" 
ON public.mind_maps 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_mind_maps_user_id ON public.mind_maps(user_id);