import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const TEXT_MIN = 10;
const TEXT_MAX = 5000;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

interface SubmitFeedbackResponse {
  requestId: string;
}

async function submitFeedback(
  text: string,
  image: File | null,
): Promise<SubmitFeedbackResponse> {
  const fd = new FormData();
  fd.append("text", text);
  if (image) fd.append("image", image, image.name);

  const res = await fetch("/api/me/feedback", {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    if (res.status === 429) {
      message = "You've sent too many requests; try again later.";
    }
    throw new Error(message);
  }
  return (await res.json()) as SubmitFeedbackResponse;
}

export function FeedbackForm() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: ({ text, image }: { text: string; image: File | null }) =>
      submitFeedback(text, image),
    onSuccess: () => {
      toast({ title: "Thanks — we got it." });
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setImage(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("Image must be 10 MB or smaller.");
      e.target.value = "";
      return;
    }
    if (file.type && !ALLOWED_IMAGE_MIMES.includes(file.type)) {
      setError("Unsupported image type.");
      e.target.value = "";
      return;
    }
    setImage(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.hei[cf]$/i.test(file.name)
    ) {
      setPreviewUrl(null);
    } else {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const trimmedLen = text.trim().length;
  const canSubmit =
    !mutation.isPending && trimmedLen >= TEXT_MIN && trimmedLen <= TEXT_MAX;

  return (
    <div className="bg-card/50 border border-border/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <MessageSquare className="w-4 h-4 text-primary" />
        <span className="font-serif font-semibold text-foreground">Send feedback</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Did you find a bug?! Or do you just have an idea? Either way let me know...
      </p>
      <Button
        type="button"
        size="sm"
        className="bg-primary hover:bg-primary/90"
        onClick={() => setOpen(true)}
      >
        Send feedback
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setError(null);
          } else {
            reset();
          }
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Tell me what's broken or what you'd like to see. You can attach one screenshot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe the bug or feature…"
                rows={6}
                maxLength={TEXT_MAX}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {trimmedLen} / {TEXT_MAX}
                {trimmedLen < TEXT_MIN && (
                  <span className="ml-2 text-muted-foreground/70">
                    (min {TEXT_MIN} chars)
                  </span>
                )}
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                onChange={handleFileChange}
                className="hidden"
              />
              {!image ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Attach image (optional)
                </Button>
              ) : (
                <div className="flex items-center gap-3 p-2 rounded-md border border-border/40 bg-background">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{image.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(image.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeImage}
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => mutation.mutate({ text, image })}
              disabled={!canSubmit}
              className="bg-primary hover:bg-primary/90"
            >
              {mutation.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
