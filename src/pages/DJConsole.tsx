import { useState } from 'react';
import { Settings, RefreshCw, Music, ListMusic, Play, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRequests, useUpdateRequestStatus } from '@/hooks/useRequests';
import { useSettings, useVerifyPin } from '@/hooks/useSettings';
import { PinModal } from '@/components/dj/PinModal';
import { RequestRow } from '@/components/dj/RequestRow';
import { SettingsModal } from '@/components/dj/SettingsModal';
import { ManualPlayModal } from '@/components/dj/ManualPlayModal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function DJConsole() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [djPin, setDjPin] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualPlayOpen, setIsManualPlayOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [manualNowPlaying, setManualNowPlaying] = useState<{ title: string; artist: string } | null>(null);

  const { data: requests, isLoading, refetch } = useRequests();
  const { data: settings } = useSettings();
  const updateStatus = useUpdateRequestStatus();
  const verifyPin = useVerifyPin();

  const handleAccept = async (requestId: string) => {
    try {
      await updateStatus.mutateAsync({ requestId, status: 'next_up' });
      toast.success('Request accepted!');
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await updateStatus.mutateAsync({ requestId, status: 'rejected' });
      toast.info('Request rejected');
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const handleMarkPlayed = async (requestId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'next_up') {
        await updateStatus.mutateAsync({ requestId, status: 'playing' });
        toast.success('Now playing!');
      } else if (currentStatus === 'playing') {
        await updateStatus.mutateAsync({ requestId, status: 'played' });
        toast.success('Marked as played');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleSyncLibrary = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-sheets', {
        body: { pin: djPin }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Synced ${data?.count || 0} songs from Google Sheets`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync library');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePinSuccess = (pin: string) => {
    setDjPin(pin);
    setIsAuthenticated(true);
  };

  const handleManualPlay = (song: { title: string; artist: string }) => {
    setManualNowPlaying(song);
    toast.success(`Now playing: ${song.title} by ${song.artist}`);
  };

  const handleClearManualPlay = () => {
    setManualNowPlaying(null);
  };

  const nowPlaying = requests?.find((r) => r.status === 'playing');
  const upNext = requests?.filter((r) => r.status === 'next_up') || [];
  const pending = requests?.filter((r) => r.status === 'pending') || [];

  // Sort pending: tipped first, then by created_at
  const sortedPending = [...pending].sort((a, b) => {
    if (a.is_tipped && !b.is_tipped) return -1;
    if (!a.is_tipped && b.is_tipped) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const eventName = settings?.event_name || 'VibeQueue';

  return (
    <div className="min-h-screen bg-background">
      <PinModal
        open={!isAuthenticated}
        onVerify={verifyPin}
        onSuccess={handlePinSuccess}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold neon-text-purple">{eventName}</h1>
              <p className="text-sm text-muted-foreground">DJ Console</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncLibrary}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync Library
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-muted/30 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {nowPlaying ? 'Now Playing' : 'Nothing playing'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-secondary" />
              <span className="text-sm text-muted-foreground">
                {upNext.length} up next
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {pending.length} pending
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Now Playing */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
              Now Playing
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsManualPlayOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Play Song
            </Button>
          </div>
          
          {nowPlaying ? (
            <RequestRow
              request={nowPlaying}
              onAccept={() => {}}
              onReject={() => {}}
              onMarkPlayed={() => handleMarkPlayed(nowPlaying.id, nowPlaying.status)}
            />
          ) : manualNowPlaying ? (
            <Card className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Music className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{manualNowPlaying.title}</h3>
                    <p className="text-sm text-muted-foreground">{manualNowPlaying.artist}</p>
                    <span className="text-xs text-muted-foreground">Manual play</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClearManualPlay}>
                  Done
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="glass-card p-6 text-center">
              <Music className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">Nothing playing</p>
              <p className="text-xs text-muted-foreground mt-1">
                Accept a request or use "Play Song" to set what's playing
              </p>
            </Card>
          )}
        </section>

        {/* Up Next */}
        {upNext.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-secondary" />
              Up Next ({upNext.length})
            </h2>
            <div className="space-y-3">
              {upNext.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onAccept={() => {}}
                  onReject={() => {}}
                  onMarkPlayed={() => handleMarkPlayed(request.id, request.status)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pending Requests */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ListMusic className="w-5 h-5" />
            Incoming Requests ({pending.length})
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sortedPending.length === 0 ? (
            <Card className="glass-card p-8 text-center">
              <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending requests</p>
              <p className="text-sm text-muted-foreground mt-1">
                Requests from the audience will appear here
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedPending.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onAccept={() => handleAccept(request.id)}
                  onReject={() => handleReject(request.id)}
                  onMarkPlayed={() => handleMarkPlayed(request.id, request.status)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        djPin={djPin}
      />

      <ManualPlayModal
        open={isManualPlayOpen}
        onClose={() => setIsManualPlayOpen(false)}
        onPlay={handleManualPlay}
      />
    </div>
  );
}