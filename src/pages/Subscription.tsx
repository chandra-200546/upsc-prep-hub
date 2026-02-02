import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/use-subscription";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, Crown, Mail, Calendar, CreditCard, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Subscription = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSubscribed, subscription, payments, userEmail, loading, refetch } = useSubscription();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const plans = [
    {
      id: "monthly",
      name: "Monthly",
      price: 199,
      period: "/month",
      features: [
        "All premium features unlocked",
        "Notes Library access",
        "Map Practice tools",
        "Mock Interview AI",
        "PYQ Engine (40 years)",
        "Mind Map generator",
        "Daily Intel Reports",
        "Optional Professor AI",
        "Voice AI explanations",
        "Auto-renewal (cancel anytime)"
      ],
      popular: false
    },
    {
      id: "yearly",
      name: "Yearly",
      price: 999,
      period: "/year",
      features: [
        "All monthly features",
        "Save ₹1,389 (58% off)",
        "Priority support",
        "Early access to new features",
        "Auto-renewal (cancel anytime)"
      ],
      popular: true
    }
  ];

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (planType: string) => {
    setProcessingPlan(planType);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Please login",
          description: "You need to be logged in to subscribe",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }

      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast({
          title: "Error",
          description: "Failed to load payment gateway",
          variant: "destructive"
        });
        setProcessingPlan(null);
        return;
      }

      // Create subscription
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { plan_type: planType },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error || data?.error) {
        console.error('Subscription error:', error || data?.error);
        toast({
          title: "Error",
          description: data?.error || "Failed to create subscription. Please try again.",
          variant: "destructive"
        });
        setProcessingPlan(null);
        return;
      }

      // Open Razorpay checkout
      const options = {
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: "UPSC Mentor",
        description: `${planType === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
        image: "/favicon.ico",
        prefill: {
          email: data.user_email
        },
        handler: async (response: any) => {
          try {
            // Verify payment
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-subscription', {
              body: {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            });

            if (verifyError || !verifyData?.success) {
              toast({
                title: "Payment verification failed",
                description: "Please contact support if amount was deducted",
                variant: "destructive"
              });
            } else {
              toast({
                title: "Subscription activated! 🎉",
                description: "You now have access to all premium features"
              });
              refetch();
            }
          } catch (err) {
            console.error('Verification error:', err);
            toast({
              title: "Error",
              description: "Payment verification failed",
              variant: "destructive"
            });
          }
          setProcessingPlan(null);
        },
        modal: {
          ondismiss: () => {
            setProcessingPlan(null);
          }
        },
        theme: {
          color: "#6366f1"
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (err) {
      console.error('Subscribe error:', err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
      setProcessingPlan(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">Subscription</h1>
              <p className="text-xs text-muted-foreground">Unlock all premium features</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* User Email Info */}
        {userEmail && (
          <Card className="p-4 bg-gradient-card border-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subscription linked to</p>
                <p className="font-medium">{userEmail}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Active Subscription */}
        {isSubscribed && subscription && (
          <Card className="p-6 bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <Crown className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Premium Active</h2>
                <p className="text-sm text-muted-foreground">
                  {subscription.plan_type === 'yearly' ? 'Yearly' : 'Monthly'} Plan
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Renews on</p>
                  <p className="text-sm font-medium">
                    {subscription.end_date ? formatDate(subscription.end_date) : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-sm font-medium">₹{subscription.amount}</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Pricing Plans */}
        {!isSubscribed && (
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
              <p className="text-muted-foreground">Get unlimited access to all premium features</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {plans.map((plan) => (
                <Card 
                  key={plan.id}
                  className={`p-6 relative ${
                    plan.popular 
                      ? 'bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/30' 
                      : 'bg-gradient-card border-0'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                        BEST VALUE
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">₹{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={processingPlan !== null}
                  >
                    {processingPlan === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Subscribe to ${plan.name}`
                    )}
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Payment History */}
        {payments && payments.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Payment History</h2>
            <Card className="bg-gradient-card border-0 overflow-hidden">
              <div className="divide-y divide-border">
                {payments.map((payment) => (
                  <div key={payment.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {payment.plan_type === 'yearly' ? 'Yearly' : 'Monthly'} Subscription
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{payment.amount}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        payment.status === 'completed' 
                          ? 'bg-success/20 text-success' 
                          : 'bg-warning/20 text-warning'
                      }`}>
                        {payment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Benefits Section */}
        <Card className="p-6 bg-gradient-card border-0">
          <h3 className="font-bold mb-4">Premium Benefits</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3">
              <div className="text-2xl mb-2">📚</div>
              <p className="text-xs font-medium">Notes Library</p>
            </div>
            <div className="text-center p-3">
              <div className="text-2xl mb-2">🗺️</div>
              <p className="text-xs font-medium">Map Practice</p>
            </div>
            <div className="text-center p-3">
              <div className="text-2xl mb-2">🎤</div>
              <p className="text-xs font-medium">Mock Interview</p>
            </div>
            <div className="text-center p-3">
              <div className="text-2xl mb-2">📊</div>
              <p className="text-xs font-medium">PYQ Engine</p>
            </div>
            <div className="text-center p-3">
              <div className="text-2xl mb-2">🧠</div>
              <p className="text-xs font-medium">Mind Maps</p>
            </div>
            <div className="text-center p-3">
              <div className="text-2xl mb-2">📰</div>
              <p className="text-xs font-medium">Daily Intel</p>
            </div>
            <div className="text-center p-3">
              <div className="text-2xl mb-2">👨‍🏫</div>
              <p className="text-xs font-medium">Optional Prof</p>
            </div>
            <div className="text-center p-3">
              <div className="text-2xl mb-2">🎙️</div>
              <p className="text-xs font-medium">Voice AI</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Subscription;
