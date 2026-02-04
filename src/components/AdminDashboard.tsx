import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Users, Crown, UserCheck, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserDetail {
  id: string;
  name: string;
  created_at: string;
  is_subscribed: boolean;
  plan_type: string | null;
  subscription_amount: number | null;
}

interface AdminStats {
  total_users: number;
  free_users_count: number;
  subscribed_users_count: number;
  users: UserDetail[];
}

const ADMIN_SECRET = "admin@7975256005";

const AdminDashboard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [typedKeys, setTypedKeys] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-stats', {
        body: { secret_code: ADMIN_SECRET }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStats(data);
    } catch (err) {
      console.error('Error fetching admin stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen for secret code typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const newTyped = typedKeys + e.key;
      
      // Keep only the last N characters where N is the secret length
      const trimmed = newTyped.slice(-ADMIN_SECRET.length);
      setTypedKeys(trimmed);

      // Check if secret was typed
      if (trimmed === ADMIN_SECRET) {
        setIsOpen(true);
        setTypedKeys("");
        fetchStats();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [typedKeys, fetchStats]);

  // Set up realtime subscription for profiles
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel('admin-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          console.log('Profile change detected, refreshing stats...');
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions'
        },
        () => {
          console.log('Subscription change detected, refreshing stats...');
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, fetchStats]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="w-6 h-6 text-primary" />
            Admin Dashboard
            <Badge variant="outline" className="ml-2">Real-time</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading && !stats ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">
            <p>{error}</p>
            <Button onClick={fetchStats} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold">{stats.total_users}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Free Users</p>
                    <p className="text-3xl font-bold">{stats.free_users_count}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-primary/20 to-accent/10 border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscribed</p>
                    <p className="text-3xl font-bold">{stats.subscribed_users_count}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Refresh Button */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchStats}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Users List */}
            <div>
              <h3 className="font-semibold mb-3">All Users</h3>
              <ScrollArea className="h-[400px] rounded-lg border">
                <div className="divide-y">
                  {stats.users.map((user) => (
                    <div 
                      key={user.id} 
                      className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          user.is_subscribed ? 'bg-gradient-to-br from-primary to-accent' : 'bg-muted-foreground'
                        }`}>
                          {user.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{user.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined: {formatDate(user.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.is_subscribed ? (
                          <>
                            <Badge className="bg-primary/20 text-primary border-primary/30">
                              <Crown className="w-3 h-3 mr-1" />
                              {user.plan_type === 'yearly' ? 'Yearly' : 'Monthly'}
                            </Badge>
                            <span className="text-sm font-medium text-primary">
                              ₹{user.subscription_amount}
                            </span>
                          </>
                        ) : (
                          <Badge variant="secondary">Free</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {stats.users.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No users found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default AdminDashboard;
