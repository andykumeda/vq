import { useState } from 'react';
import { Settings, RefreshCw, Music, ListMusic, Play, Clock, Plus, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRequests, useUpdateRequestStatus, useCreateManualPlay, useUpdateSong, useReorderRequests, useClearHistory } from '@/hooks/useRequests';
import { useSettings, useVerifyPin, useSyncGoogleSheets } from '@/hooks/useSettings';
import { PinModal } from '@/components/dj/PinModal';
import { RequestRow } from '@/components/dj/RequestRow';
import { SettingsModal } from '@/components/dj/SettingsModal';
import { ManualPlayModal } from '@/components/dj/ManualPlayModal';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRequestRowProps {
  request: any;
  onAccept: () => void;
  onReject: () => void;
  onMarkPlayed: () => void;
  onUpdateSong: (songId: string, title: string, artist: string) => void;
}

function SortableRequestRow({ request, onAccept, onReject, onMarkPlayed, onUpdateSong }: SortableRequestRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: request.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <RequestRow
          request={request}
          onAccept={onAccept}
          onReject={onReject}
          onMarkPlayed={onMarkPlayed}
          onUpdateSong={onUpdateSong}
        />
      </div>
    </div>
  );
}

export default function DJConsole() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [djPin, setDjPin] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualPlayOpen, setIsManualPlayOpen] = useState(false);

  const { data: requests, isLoading, refetch } = useRequests();
  const { data: settings } = useSettings();
  const updateStatus = useUpdateRequestStatus();
  const verifyPin = useVerifyPin();
  const syncLibrary = useSyncGoogleSheets();
  const createManualPlay = useCreateManualPlay();
  const updateSong = useUpdateSong();
  const reorderRequests = useReorderRequests();
  const clearHistory = useClearHistory();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleUpdateSong = async (songId: string, title: string, artist: string) => {
    try {
      await updateSong.mutateAsync({ songId, title, artist });
      toast.success('Song details updated');
    } catch (error) {
      toast.error('Failed to update song details');
    }
  };

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
    try {
      const result = await syncLibrary.mutateAsync(djPin);
      toast.success(`Synced ${result?.count || 0} songs from Google Sheets`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync library');
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear all played history? This cannot be undone.')) {
      return;
    }
    try {
      const result = await clearHistory.mutateAsync(djPin);
      toast.success(`Cleared ${result?.count || 0} played songs from history`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear history');
    }
  };

  const handlePinSuccess = (pin: string) => {
    setDjPin(pin);
    setIsAuthenticated(true);
  };

  const handleManualPlay = async (song: { title: string; artist: string }) => {
    try {
      await createManualPlay.mutateAsync(song);
      toast.success(`Now playing: ${song.title} by ${song.artist}`);
    } catch (error) {
      toast.error('Failed to set now playing');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = upNext.findIndex((r: any) => r.id === active.id);
    const newIndex = upNext.findIndex((r: any) => r.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedItems = arrayMove(upNext, oldIndex, newIndex);
    const positions = reorderedItems.map((item: any, index: number) => ({
      id: item.id,
      position: index,
    }));
    
    try {
      await reorderRequests.mutateAsync(positions);
    } catch (error) {
      toast.error('Failed to reorder queue');
    }
  };

  const nowPlaying = requests?.find((r: any) => r.status === 'playing');
  const upNext = requests?.filter((r: any) => r.status === 'next_up') || [];
  const pending = requests?.filter((r: any) => r.status === 'pending') || [];

  const sortedPending = [...pending].sort((a: any, b: any) => {
    if (a.isTipped && !b.isTipped) return -1;
    if (!a.isTipped && b.isTipped) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const eventName = settings?.event_name || 'VibeQueue';

  return (
    <div className="min-h-screen bg-background">
      <PinModal
        open={!isAuthenticated}
        onVerify={verifyPin}
        onSuccess={handlePinSuccess}
      />

      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold neon-text-purple">{eventName}</h1>
              <p className="text-sm text-muted-foreground">DJ Console</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncLibrary}
                disabled={syncLibrary.isPending}
                data-testid="button-sync-library"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncLibrary.isPending ? 'animate-spin' : ''}`} />
                Sync Library
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                disabled={clearHistory.isPending}
                data-testid="button-clear-history"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        <section>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
              Now Playing
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsManualPlayOpen(true)}
              data-testid="button-manual-play"
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
              onUpdateSong={handleUpdateSong}
            />
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

        {upNext.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-secondary" />
              Up Next ({upNext.length})
              <span className="text-xs font-normal text-muted-foreground ml-2">Drag to reorder</span>
            </h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={upNext.map((r: any) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {upNext.map((request: any) => (
                    <SortableRequestRow
                      key={request.id}
                      request={request}
                      onAccept={() => {}}
                      onReject={() => {}}
                      onMarkPlayed={() => handleMarkPlayed(request.id, request.status)}
                      onUpdateSong={handleUpdateSong}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        )}

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
              {sortedPending.map((request: any) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onAccept={() => handleAccept(request.id)}
                  onReject={() => handleReject(request.id)}
                  onMarkPlayed={() => handleMarkPlayed(request.id, request.status)}
                  onUpdateSong={handleUpdateSong}
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
