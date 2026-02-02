import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Subscription {
  id: string;
  user_id: string;
  razorpay_subscription_id: string | null;
  plan_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  amount: number | null;
  currency: string | null;
}

interface Payment {
  id: string;
  razorpay_payment_id: string | null;
  amount: number;
  plan_type: string;
  status: string;
  created_at: string;
}

interface SubscriptionState {
  isSubscribed: boolean;
  subscription: Subscription | null;
  payments: Payment[];
  userEmail: string | null;
  loading: boolean;
  error: string | null;
}

export const useSubscription = () => {
  const [state, setState] = useState<SubscriptionState>({
    isSubscribed: false,
    subscription: null,
    payments: [],
    userEmail: null,
    loading: true,
    error: null
  });

  const checkSubscription = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setState({
          isSubscribed: false,
          subscription: null,
          payments: [],
          userEmail: null,
          loading: false,
          error: null
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Error checking subscription:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
        return;
      }

      setState({
        isSubscribed: data.is_subscribed,
        subscription: data.subscription,
        payments: data.payments || [],
        userEmail: data.user_email,
        loading: false,
        error: null
      });
    } catch (err) {
      console.error('Unexpected error:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to check subscription'
      }));
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...state,
    refetch: checkSubscription
  };
};

// Premium features that require subscription
export const PREMIUM_FEATURES = [
  '/notes',
  '/map-practice',
  '/mock-interview',
  '/pyq-engine',
  '/mind-map',
  '/daily-intel',
  '/optional-professor',
  '/voice-ai'
];

export const isPremiumFeature = (path: string): boolean => {
  return PREMIUM_FEATURES.includes(path);
};
