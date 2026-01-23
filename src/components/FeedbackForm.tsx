import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Star, Send, MessageSquareHeart } from "lucide-react";

const FeedbackForm = () => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [improvements, setImprovements] = useState("");
  const [problems, setProblems] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast({
        title: "Please select a rating",
        description: "Star rating is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("https://formspree.io/f/mykepkea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          review: review.trim(),
          improvements: improvements.trim(),
          problems: problems.trim(),
        }),
      });

      if (response.ok) {
        toast({
          title: "Thank you for your feedback!",
          description: "Your review has been submitted successfully.",
        });
        setRating(0);
        setReview("");
        setImprovements("");
        setProblems("");
      } else {
        throw new Error("Failed to submit");
      }
    } catch (error) {
      toast({
        title: "Submission failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-card border-0 mt-4">
      <div className="flex items-center gap-3 mb-4">
        <MessageSquareHeart className="w-6 h-6 text-primary" />
        <h3 className="text-lg font-bold">Share Your Feedback</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Star Rating */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Rate Your Experience</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= (hoverRating || rating)
                      ? "fill-warning text-warning"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Review */}
        <div>
          <Label htmlFor="review" className="text-sm font-medium mb-2 block">
            Your Review
          </Label>
          <Textarea
            id="review"
            placeholder="Tell us about your experience with UPSC Mentor..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>

        {/* Improvements */}
        <div>
          <Label htmlFor="improvements" className="text-sm font-medium mb-2 block">
            What Should We Improve?
          </Label>
          <Input
            id="improvements"
            placeholder="Features, UI, content, etc."
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
          />
        </div>

        {/* Problems */}
        <div>
          <Label htmlFor="problems" className="text-sm font-medium mb-2 block">
            Any Problems You're Facing?
          </Label>
          <Textarea
            id="problems"
            placeholder="Describe any issues or bugs..."
            value={problems}
            onChange={(e) => setProblems(e.target.value)}
            className="min-h-[60px] resize-none"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full gap-2"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </Button>
      </form>
    </Card>
  );
};

export default FeedbackForm;
