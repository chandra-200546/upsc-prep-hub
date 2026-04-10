import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/components/ui/use-toast";
import { Copy, ExternalLink, Facebook, Link2, Linkedin, Mail, MessageCircle, Send, Share2, Twitter } from "lucide-react";

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
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // try fallback below
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    // final fallback below
  }

  window.prompt("Copy this link:", text);
  return false;
};

const BrandDot = ({ icon, bgClass }: { icon: ReactNode; bgClass: string }) => (
  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white ${bgClass}`}>
    {icon}
  </span>
);

export function SocialShareSheet({ open, onOpenChange, title, url, onTrackShare, shareCount = 0 }: Props) {
  const isMobile = useIsMobile();
  const [busy, setBusy] = useState<string>("");

  const payloadText = useMemo(() => `${title}\n${url}`, [title, url]);

  const openWindow = async (href: string) => {
    const win = window.open(href, "_blank", "noopener,noreferrer");
    if (win) return;
    const copied = await tryClipboardCopy(href);
    toast({
      title: copied ? "Popup blocked" : "Share link ready",
      description: copied
        ? "Browser blocked popup. Link copied, paste it in your app."
        : "Browser blocked popup. Copy the link manually from prompt.",
    });
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
    <div className="grid grid-cols-2 gap-2 pb-2 sm:grid-cols-3">
      <Button
        variant="outline"
        className="h-11 justify-start gap-2 rounded-xl border-border/70"
        disabled={busy === "copy_link"}
        onClick={() =>
          withTrack("copy_link", async () => {
            const copied = await tryClipboardCopy(url);
            toast({ title: copied ? "Link copied" : "Manual copy opened" });
          })
        }
      >
        <BrandDot icon={<Copy className="h-4 w-4" />} bgClass="bg-slate-700" />
        Copy Link
      </Button>

      <Button
        variant="outline"
        className="h-11 justify-start gap-2 rounded-xl border-border/70"
        disabled={busy === "native"}
        onClick={() =>
          withTrack("native", async () => {
            const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
            if (!nav.share) {
              const copied = await tryClipboardCopy(url);
              toast({ title: "Link copied", description: "Native share is not supported on this device." });
              if (!copied) {
                toast({ title: "Manual copy opened", description: "Paste the link where you want to share." });
              }
              return;
            }
            await nav.share({ title: "UPSC Share", text: title, url });
            toast({ title: "Shared successfully" });
          })
        }
      >
        <BrandDot icon={<ExternalLink className="h-4 w-4" />} bgClass="bg-violet-600" />
        Native Share
      </Button>

      <Button variant="outline" className="h-11 justify-start gap-2 rounded-xl border-border/70" onClick={() => withTrack("whatsapp", () => openWindow(`https://wa.me/?text=${encodeURIComponent(payloadText)}`))}>
        <BrandDot icon={<MessageCircle className="h-4 w-4" />} bgClass="bg-emerald-500" />
        WhatsApp
      </Button>

      <Button variant="outline" className="h-11 justify-start gap-2 rounded-xl border-border/70" onClick={() => withTrack("x", () => openWindow(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`))}>
        <BrandDot icon={<Twitter className="h-4 w-4" />} bgClass="bg-black" />
        X / Twitter
      </Button>

      <Button variant="outline" className="h-11 justify-start gap-2 rounded-xl border-border/70" onClick={() => withTrack("telegram", () => openWindow(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`))}>
        <BrandDot icon={<Send className="h-4 w-4" />} bgClass="bg-sky-500" />
        Telegram
      </Button>

      <Button
        variant="outline"
        className="h-11 justify-start gap-2 rounded-xl border-border/70"
        onClick={() =>
          withTrack("email", () => {
            window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(payloadText)}`;
          })
        }
      >
        <BrandDot icon={<Mail className="h-4 w-4" />} bgClass="bg-indigo-600" />
        Email
      </Button>

      <Button
        variant="outline"
        className="h-11 justify-start gap-2 rounded-xl border-border/70"
        onClick={() => withTrack("facebook", () => openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`))}
      >
        <BrandDot icon={<Facebook className="h-4 w-4" />} bgClass="bg-blue-600" />
        Facebook
      </Button>

      <Button
        variant="outline"
        className="h-11 justify-start gap-2 rounded-xl border-border/70"
        onClick={() =>
          withTrack("linkedin", () =>
            openWindow(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`),
          )
        }
      >
        <BrandDot icon={<Linkedin className="h-4 w-4" />} bgClass="bg-blue-700" />
        LinkedIn
      </Button>

      <Button
        variant="outline"
        className="h-11 justify-start gap-2 rounded-xl border-border/70"
        onClick={() =>
          withTrack("reddit", () =>
            openWindow(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`),
          )
        }
      >
        <BrandDot icon={<span className="text-xs font-bold">r/</span>} bgClass="bg-orange-500" />
        Reddit
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-3">
          <DrawerHeader>
            <DrawerTitle>Share Post</DrawerTitle>
            <DrawerDescription className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Shares: {shareCount}
            </DrawerDescription>
          </DrawerHeader>
        <div className="mb-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Post Link</div>
          <div className="truncate rounded-md bg-background/70 px-2 py-1 font-mono">{url}</div>
        </div>
          {shareOptions}
        </DrawerContent>
      </Drawer>
  );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border-border/80">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Shares: {shareCount}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Shareable Link</div>
          <div className="truncate rounded-md bg-background/70 px-2 py-1 font-mono">{url}</div>
        </div>
        {shareOptions}
      </DialogContent>
    </Dialog>
  );
}
