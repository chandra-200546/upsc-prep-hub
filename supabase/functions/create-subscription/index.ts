import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('Razorpay credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { plan_type } = await req.json();
    
    if (!plan_type || !['monthly', 'yearly'].includes(plan_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan type. Must be monthly or yearly' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Plan configurations
    const planConfig = {
      monthly: {
        amount: 19900, // ₹199 in paise
        period: 'monthly',
        interval: 1,
        description: 'UPSC Mentor Monthly Subscription'
      },
      yearly: {
        amount: 99900, // ₹999 in paise
        period: 'yearly',
        interval: 1,
        description: 'UPSC Mentor Yearly Subscription'
      }
    };

    const selectedPlan = planConfig[plan_type as keyof typeof planConfig];

    console.log(`Creating ${plan_type} subscription for user: ${user.id}, email: ${user.email}`);

    // Create Razorpay subscription
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // First, create or get a plan
    const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        period: selectedPlan.period,
        interval: selectedPlan.interval,
        item: {
          name: selectedPlan.description,
          amount: selectedPlan.amount,
          currency: 'INR',
          description: selectedPlan.description
        }
      })
    });

    const planData = await planResponse.json();
    
    if (!planResponse.ok) {
      console.error('Failed to create Razorpay plan:', planData);
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription plan', details: planData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Razorpay plan created:', planData.id);

    // Create subscription
    const subscriptionResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: planData.id,
        total_count: plan_type === 'yearly' ? 10 : 120, // Max billing cycles
        quantity: 1,
        customer_notify: 1,
        notes: {
          user_id: user.id,
          user_email: user.email,
          plan_type: plan_type
        }
      })
    });

    const subscriptionData = await subscriptionResponse.json();

    if (!subscriptionResponse.ok) {
      console.error('Failed to create Razorpay subscription:', subscriptionData);
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription', details: subscriptionData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Razorpay subscription created:', subscriptionData.id);

    // Save subscription to database
    const { data: dbSubscription, error: dbError } = await supabaseClient
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        razorpay_subscription_id: subscriptionData.id,
        plan_type: plan_type,
        status: 'created',
        amount: selectedPlan.amount / 100, // Convert back to rupees
        currency: 'INR'
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Don't fail - subscription was created in Razorpay
    }

    return new Response(
      JSON.stringify({
        subscription_id: subscriptionData.id,
        short_url: subscriptionData.short_url,
        key_id: razorpayKeyId,
        amount: selectedPlan.amount,
        currency: 'INR',
        plan_type: plan_type,
        user_email: user.email,
        db_subscription: dbSubscription
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
