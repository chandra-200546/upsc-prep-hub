import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/components/ui/use-toast";
import { Copy, Mail, MessageCircle, Send, Share2 } from "lucide-react";

export type SharePlatform =
  | "copy_link"
  | "whatsapp"
  | "x"
  | "telegram"
  | "email"
  | "native"
  | "facebook"
  | "linkedin"
  | "reddit"
  | "other";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
  onTrackShare?: (platform: SharePlatform) => Promise<void> | void;
  shareCount?: number;
};

const tryClipboardCopy = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("Clipboard unavailable");
};

export function SocialShareSheet({ open, onOpenChange, title, url, onTrackShare, shareCount = 0 }: Props) {
  const isMobile = useIsMobile();
  const [busy, setBusy] = useState<string>("");

  const payloadText = useMemo(() => `${title}\n${url}`, [title, url]);

  const openWindow = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const withTrack = async (platform: SharePlatform, action: () => Promise<void> | void) => {
    setBusy(platform);
    try {
      await action();
      await onTrackShare?.(platform);
    } catch (error: any) {
      toast({
        title: "Share failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy("");
    }
  };

  const shareOptions = (
    <div className="grid grid-cols-2 gap-2 pb-2">
      <Button
        variant="outline"
        className="justify-start gap-2"
        disabled={busy === "copy_link"}
        onClick={() =>
          withTrack("copy_link", async () => {
            await tryClipboardCopy(url);
            toast({ title: "Link copied" });
          })
        }
      >
        <Copy className="h-4 w-4" />
        Copy Link
      </Button>

      <Button
        variant="outline"
        className="justify-start gap-2"
        disabled={busy === "native"}
        onClick={() =>
          withTrack("native", async () => {
            const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
            if (!nav.share) {
              throw new Error("Native share is not supported on this device.");
            }
            await nav.share({ title: "UPSC Share", text: title, url });
            toast({ title: "Shared successfully" });
          })
        }
      >
        <Share2 className="h-4 w-4" />
        Native Share
      </Button>

      <Button variant="outline" className="justify-start gap-2" onClick={() => withTrack("whatsapp", () => openWindow(`https://wa.me/?text=${encodeURIComponent(payloadText)}`))}>
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>

      <Button variant="outline" className="justify-start gap-2" onClick={() => withTrack("x", () => openWindow(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`))}>
        <Share2 className="h-4 w-4" />
        X / Twitter
      </Button>

      <Button variant="outline" className="justify-start gap-2" onClick={() => withTrack("telegram", () => openWindow(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`))}>
        <Send className="h-4 w-4" />
        Telegram
      </Button>

      <Button
        variant="outline"
        className="justify-start gap-2"
        onClick={() =>
          withTrack("email", () => {
            window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(payloadText)}`;
          })
        }
      >
        <Mail className="h-4 w-4" />
        Email
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4">
          <DrawerHeader>
            <DrawerTitle>Share Post</DrawerTitle>
            <DrawerDescription>Shares: {shareCount}</DrawerDescription>
          </DrawerHeader>
          {shareOptions}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
          <DialogDescription>Shares: {shareCount}</DialogDescription>
        </DialogHeader>
        {shareOptions}
      </DialogContent>
    </Dialog>
  );
}

