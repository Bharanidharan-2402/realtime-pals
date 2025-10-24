import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  last_seen: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: Profile;
}

export default function Chat() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    // Update user status to online
    const updateStatus = async () => {
      await supabase
        .from('profiles')
        .update({ status: 'online', last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };
    
    updateStatus();

    // Set up interval to update last_seen
    const interval = setInterval(updateStatus, 30000);

    // Update status to offline on unmount
    return () => {
      clearInterval(interval);
      supabase
        .from('profiles')
        .update({ status: 'offline', last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Load friends
    const loadFriends = async () => {
      const { data: friendshipsData } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id);

      if (friendshipsData) {
        const friendIds = friendshipsData.map(f => f.friend_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', friendIds);

        if (profilesData) {
          setFriends(profilesData);
        }
      }
    };

    // Load friend requests
    const loadRequests = async () => {
      const { data } = await supabase
        .from('friend_requests')
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey(*)
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (data) {
        setFriendRequests(data as any);
      }
    };

    loadFriends();
    loadRequests();

    // Subscribe to friendships changes
    const friendshipsChannel = supabase
      .channel('friendships-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadFriends();
        }
      )
      .subscribe();

    // Subscribe to friend requests
    const requestsChannel = supabase
      .channel('requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    // Subscribe to profile updates for online status
    const profilesChannel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          loadFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendshipsChannel);
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex bg-background">
      <Sidebar
        friends={friends}
        friendRequests={friendRequests}
        selectedFriend={selectedFriend}
        onSelectFriend={setSelectedFriend}
        currentUserId={user.id}
      />
      <ChatArea
        selectedFriend={selectedFriend}
        currentUserId={user.id}
      />
    </div>
  );
}
