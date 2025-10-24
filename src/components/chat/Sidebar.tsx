import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, LogOut, UserPlus, Check, X, Search } from 'lucide-react';
import { Profile, FriendRequest } from '@/pages/Chat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SidebarProps {
  friends: Profile[];
  friendRequests: FriendRequest[];
  selectedFriend: Profile | null;
  onSelectFriend: (friend: Profile) => void;
  currentUserId: string;
}

export function Sidebar({ friends, friendRequests, selectedFriend, onSelectFriend, currentUserId }: SidebarProps) {
  const { signOut } = useAuth();
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);

  const sendFriendRequest = async () => {
    if (!searchEmail) return;
    
    setSearching(true);
    try {
      // Find user by email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', searchEmail)
        .single();

      if (!profiles) {
        toast.error('User not found');
        return;
      }

      if (profiles.id === currentUserId) {
        toast.error('You cannot add yourself');
        return;
      }

      // Send friend request
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: currentUserId,
          receiver_id: profiles.id,
          status: 'pending'
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Friend request already sent');
        } else {
          throw error;
        }
      } else {
        toast.success('Friend request sent!');
        setSearchEmail('');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSearching(false);
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;
      toast.success('Friend request accepted!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
      toast.success('Friend request rejected');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="w-80 border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-primary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
            <span className="font-semibold text-primary-foreground">ChatAp</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Add Friend */}
      <div className="p-4 border-b border-border">
        <div className="flex gap-2">
          <Input
            placeholder="Enter email to add friend"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendFriendRequest()}
          />
          <Button
            size="icon"
            onClick={sendFriendRequest}
            disabled={searching || !searchEmail}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <>
          <div className="px-4 py-2 bg-muted">
            <span className="text-sm font-medium text-muted-foreground">
              Friend Requests ({friendRequests.length})
            </span>
          </div>
          <div className="px-2">
            {friendRequests.map((request) => (
              <div key={request.id} className="p-2 flex items-center justify-between hover:bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {request.sender?.display_name?.[0] || request.sender?.email[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {request.sender?.display_name || request.sender?.email}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-primary"
                    onClick={() => acceptRequest(request.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => rejectRequest(request.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Separator />
        </>
      )}

      {/* Contacts */}
      <div className="px-4 py-2 bg-muted">
        <span className="text-sm font-medium text-muted-foreground">
          Contacts ({friends.length})
        </span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="px-2">
          {friends.map((friend) => (
            <button
              key={friend.id}
              onClick={() => onSelectFriend(friend)}
              className={`w-full p-3 flex items-center gap-3 hover:bg-muted rounded-lg transition-colors ${
                selectedFriend?.id === friend.id ? 'bg-muted' : ''
              }`}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {friend.display_name?.[0] || friend.email[0]}
                  </AvatarFallback>
                </Avatar>
                {friend.status === 'online' && (
                  <div className="absolute bottom-0 right-0 h-3 w-3 bg-primary rounded-full border-2 border-card" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium truncate">
                  {friend.display_name || friend.email}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {friend.status === 'online' ? 'Online' : 'Offline'}
                </div>
              </div>
            </button>
          ))}
          {friends.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No contacts yet. Add friends to start chatting!
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
