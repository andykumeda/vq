import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Music, ListMusic, PlusCircle } from 'lucide-react';
import { useUsername } from '@/hooks/useUsername';
import { useSongs } from '@/hooks/useSongs';
import { useRequests, useCreateRequest, useCreateCustomRequest, useCheckDuplicateRequest } from '@/hooks/useRequests';
import { usePaymentHandles } from '@/hooks/useSettings';
import { UsernameModal } from '@/components/audience/UsernameModal';
import { SearchBar } from '@/components/audience/SearchBar';
import { SongCard } from '@/components/audience/SongCard';
import { RequestModal } from '@/components/audience/RequestModal';
import { CustomRequestModal } from '@/components/audience/CustomRequestModal';
import { QueueItem } from '@/components/audience/QueueItem';
import { toast } from 'sonner';
import type { Song } from '@/types/vibequeue';

export default function AudienceView() {
  const { username, setUsername } = useUsername();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isCustomRequestModalOpen, setIsCustomRequestModalOpen] = useState(false);

  const { data: songs, isLoading: songsLoading } = useSongs(searchQuery);
  const { data: requests } = useRequests();
  const { handles: paymentHandles } = usePaymentHandles();
  const createRequest = useCreateRequest();
  const createCustomRequest = useCreateCustomRequest();
  const checkDuplicate = useCheckDuplicateRequest();

  const handleSongClick = async (song: Song) => {
    const isDuplicate = await checkDuplicate(song.id);
    if (isDuplicate) {
      toast.error('This song is already in the queue!');
      return;
    }
    setSelectedSong(song);
    setIsRequestModalOpen(true);
  };

  const handleSubmitRequest = async (isTipped: boolean) => {
    if (!selectedSong || !username) return;

    try {
      await createRequest.mutateAsync({
        songId: selectedSong.id,
        username,
        isTipped,
      });
      toast.success('Request submitted!');
      setIsRequestModalOpen(false);
      setSelectedSong(null);
    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  const handleCustomSubmitRequest = async (title: string, artist: string, isTipped: boolean) => {
    if (!username) return;

    try {
      await createCustomRequest.mutateAsync({
        title,
        artist,
        username,
        isTipped,
      });
      toast.success('Custom request submitted!');
      setIsCustomRequestModalOpen(false);
    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  const activeRequests = requests?.filter((r) =>
    ['pending', 'next_up', 'playing'].includes(r.status)
  ) || [];

  const nowPlaying = activeRequests.find((r) => r.status === 'playing');
  const upNext = activeRequests.filter((r) => r.status === 'next_up');
  const pending = activeRequests.filter((r) => r.status === 'pending');

  return (
    <div className="min-h-screen bg-background">
      <UsernameModal
        open={!username}
        onSubmit={setUsername}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold neon-text-purple">VibeQueue</h1>
            {username && (
              <span className="text-sm text-muted-foreground">
                Hey, <span className="text-primary">{username}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        <Tabs defaultValue="songs" className="w-full">
          <TabsList className="w-full h-12 bg-muted/50 rounded-none border-b border-border/50">
            <TabsTrigger
              value="songs"
              className="flex-1 h-full data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <Music className="w-4 h-4 mr-2" />
              Songs
            </TabsTrigger>
            <TabsTrigger
              value="queue"
              className="flex-1 h-full data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <ListMusic className="w-4 h-4 mr-2" />
              Queue
              {activeRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-primary/20 rounded-full text-xs">
                  {activeRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="songs" className="mt-0">
            <div className="p-4 space-y-4">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />

              {songsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : songs?.length === 0 ? (
                <div className="text-center py-12">
                  <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery ? 'No songs found' : 'No songs available'}
                  </p>
                  <Button
                    onClick={() => setIsCustomRequestModalOpen(true)}
                    variant="outline"
                    className="border-secondary/50 text-secondary hover:bg-secondary/10"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Request a different song
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {songs?.map((song) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      onClick={() => handleSongClick(song)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="queue" className="mt-0">
            <div className="p-4 space-y-6">
              {nowPlaying && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    Now Playing
                  </h3>
                  <QueueItem
                    request={nowPlaying}
                    isOwn={nowPlaying.requester_username === username}
                  />
                </section>
              )}

              {upNext.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Up Next
                  </h3>
                  <div className="space-y-3">
                    {upNext.map((request) => (
                      <QueueItem
                        key={request.id}
                        request={request}
                        isOwn={request.requester_username === username}
                      />
                    ))}
                  </div>
                </section>
              )}

              {pending.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Pending Requests
                  </h3>
                  <div className="space-y-3">
                    {pending.map((request) => (
                      <QueueItem
                        key={request.id}
                        request={request}
                        isOwn={request.requester_username === username}
                      />
                    ))}
                  </div>
                </section>
              )}

              {activeRequests.length === 0 && (
                <div className="text-center py-12">
                  <ListMusic className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Queue is empty</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Be the first to request a song!
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <RequestModal
        open={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false);
          setSelectedSong(null);
        }}
        song={selectedSong}
        paymentHandles={paymentHandles}
        onSubmit={handleSubmitRequest}
        isLoading={createRequest.isPending}
      />

      <CustomRequestModal
        open={isCustomRequestModalOpen}
        onClose={() => setIsCustomRequestModalOpen(false)}
        paymentHandles={paymentHandles}
        onSubmit={handleCustomSubmitRequest}
        isLoading={createCustomRequest.isPending}
      />
    </div>
  );
}
