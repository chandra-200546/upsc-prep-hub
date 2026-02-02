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

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();

    console.log(`Verifying subscription payment for user: ${user.id}`);
    console.log(`Payment ID: ${razorpay_payment_id}, Subscription ID: ${razorpay_subscription_id}`);

    // Verify signature using crypto
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(razorpayKeySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Invalid payment signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signature verified successfully');

    // Get subscription details from Razorpay
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const subscriptionResponse = await fetch(`https://api.razorpay.com/v1/subscriptions/${razorpay_subscription_id}`, {
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
      }
    });

    const subscriptionData = await subscriptionResponse.json();
    console.log('Razorpay subscription data:', subscriptionData);

    // Calculate end date based on plan
    const startDate = new Date();
    const endDate = new Date();
    
    if (subscriptionData.notes?.plan_type === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Update subscription in database
    const { data: updatedSubscription, error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({
        status: 'active',
        razorpay_subscription_id: razorpay_subscription_id,
        razorpay_customer_id: subscriptionData.customer_id || null,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update subscription:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record payment
    const { error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        user_id: user.id,
        subscription_id: updatedSubscription.id,
        razorpay_payment_id: razorpay_payment_id,
        razorpay_order_id: razorpay_subscription_id,
        amount: updatedSubscription.amount,
        currency: 'INR',
        plan_type: updatedSubscription.plan_type,
        status: 'completed'
      });

    if (paymentError) {
      console.error('Failed to record payment:', paymentError);
      // Don't fail - subscription is already activated
    }

    console.log('Subscription activated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        subscription: updatedSubscription,
        message: 'Subscription activated successfully'
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
