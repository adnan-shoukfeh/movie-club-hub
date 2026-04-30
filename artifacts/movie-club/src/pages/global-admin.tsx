import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { ArrowLeft, Shield, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StickerGrid } from "@/domains/admin/components/StickerGrid";
import { StickerUploadModal } from "@/domains/admin/components/StickerUploadModal";

const SUPER_ADMIN_USERNAME = "dingle_documentary";

interface Sticker {
  id: number;
  name: string;
  imageUrl: string;
  isGlobal: boolean;
}

export default function GlobalAdmin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useGetMe();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isSuperAdmin = me?.username === SUPER_ADMIN_USERNAME;

  const { data: stickersData, isLoading: stickersLoading } = useQuery({
    queryKey: ["global-stickers"],
    queryFn: async () => {
      const res = await fetch("/api/stickers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stickers");
      return res.json() as Promise<{ stickers: Sticker[] }>;
    },
    enabled: isSuperAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (stickerId: number) => {
      const res = await fetch(`/api/stickers/${stickerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete sticker");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-stickers"] });
      setDeletingId(null);
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = async (stickerId: number, name: string) => {
    if (!confirm(`Delete sticker "${name}"? This will remove all reactions using this sticker.`)) {
      return;
    }
    setDeletingId(stickerId);
    deleteMutation.mutate(stickerId);
  };

  if (meLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!me) {
    setLocation("/");
    return null;
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Access denied</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-serif font-bold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Global Admin
              </h1>
              <span className="text-xs text-muted-foreground">Manage global stickers</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif font-semibold text-foreground">Global Stickers</h2>
            <Button
              size="sm"
              onClick={() => setUploadOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Upload
            </Button>
          </div>

          {stickersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <StickerGrid
              stickers={stickersData?.stickers ?? []}
              onDelete={handleDelete}
              isDeleting={deletingId}
              emptyMessage="No global stickers yet. Upload some to get started!"
            />
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Global stickers are available to all groups. Upload PNG, GIF, or WEBP images (max 2MB).
        </p>
      </main>

      <StickerUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["global-stickers"] });
        }}
      />
    </div>
  );
}
