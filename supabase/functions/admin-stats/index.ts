import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ADMIN_SECRET_CODE = "admin@7975256005";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { secret_code } = await req.json();

    // Validate the secret code
    if (secret_code !== ADMIN_SECRET_CODE) {
      console.log('Invalid admin secret code attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get all profiles (all users)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all subscriptions with active status
    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, plan_type, status, amount, created_at')
      .eq('status', 'active');

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a set of subscribed user IDs
    const subscribedUserIds = new Set(subscriptions?.map(s => s.user_id) || []);

    // Categorize users
    const allUsers = profiles || [];
    const subscribedUsers = allUsers.filter(user => subscribedUserIds.has(user.id));
    const freeUsers = allUsers.filter(user => !subscribedUserIds.has(user.id));

    // Create detailed user list with subscription info
    const usersWithDetails = allUsers.map(user => {
      const userSubscription = subscriptions?.find(s => s.user_id === user.id);
      return {
        id: user.id,
        name: user.name,
        created_at: user.created_at,
        is_subscribed: subscribedUserIds.has(user.id),
        plan_type: userSubscription?.plan_type || null,
        subscription_amount: userSubscription?.amount || null
      };
    });

    const stats = {
      total_users: allUsers.length,
      free_users_count: freeUsers.length,
      subscribed_users_count: subscribedUsers.length,
      users: usersWithDetails,
      subscribed_users: subscribedUsers.map(u => ({
        ...u,
        subscription: subscriptions?.find(s => s.user_id === u.id)
      })),
      free_users: freeUsers
    };

    console.log(`Admin stats requested - Total: ${stats.total_users}, Free: ${stats.free_users_count}, Subscribed: ${stats.subscribed_users_count}`);

    return new Response(
      JSON.stringify(stats),
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
