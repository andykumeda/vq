import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";
import { Music, Music2, Play, Sparkles, MessageSquareHeart } from "lucide-react";

const Index = () => {
  const { data: settings } = useSettings();
  const eventName = settings?.event_name || "VibeQueue";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-white">
      <div className="w-full max-w-2xl text-center space-y-8 animate-fade-in">
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center neon-glow-purple mb-6">
            <Music2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight neon-text-purple mb-2">
            {eventName}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium">
            Your live request line.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          <div className="glass-card p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center mx-auto">
              <Music className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="font-bold">Browse</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Explore the DJ's full library of songs.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl border-primary/30 space-y-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-primary">Request</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pick your favorite track and jump in the queue.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center mx-auto">
              <MessageSquareHeart className="w-5 h-5 text-pink-500" />
            </div>
            <h3 className="font-bold">Vibe</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get notified when your song plays and show the DJ love.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-10">
          <Link to="/audience">
            <Button size="lg" className="h-16 px-10 text-xl font-bold rounded-full neon-glow-purple group">
              Start Requesting
              <Play className="ml-2 w-5 h-5 fill-current transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/50 pt-8 uppercase tracking-widest">
          Powering the vibe at {eventName}
        </p>
      </div>
    </div>
  );
};

export default Index;