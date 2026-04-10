import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/components/ui/use-toast";
import { Copy, Link2, Share2 } from "lucide-react";

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

const BrandDot = ({ text, bgClass }: { text: string; bgClass: string }) => (
  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ${bgClass}`}>
    {text}
  </span>
);

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
    <div className="grid grid-cols-2 gap-2 pb-2 sm:grid-cols-3">
      <Button
        variant="outline"
        className="justify-start gap-2 rounded-xl"
        disabled={busy === "copy_link"}
        onClick={() =>
          withTrack("copy_link", async () => {
            await tryClipboardCopy(url);
            toast({ title: "Link copied" });
          })
        }
      >
        <BrandDot text="⎘" bgClass="bg-slate-700" />
        Copy Link
      </Button>

      <Button
        variant="outline"
        className="justify-start gap-2 rounded-xl"
        disabled={busy === "native"}
        onClick={() =>
          withTrack("native", async () => {
            const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
            if (!nav.share) {
              await tryClipboardCopy(url);
              toast({ title: "Link copied", description: "Native share is not supported on this device." });
              return;
            }
            await nav.share({ title: "UPSC Share", text: title, url });
            toast({ title: "Shared successfully" });
          })
        }
      >
        <BrandDot text="↗" bgClass="bg-violet-600" />
        Native Share
      </Button>

      <Button variant="outline" className="justify-start gap-2 rounded-xl" onClick={() => withTrack("whatsapp", () => openWindow(`https://wa.me/?text=${encodeURIComponent(payloadText)}`))}>
        <BrandDot text="W" bgClass="bg-emerald-500" />
        WhatsApp
      </Button>

      <Button variant="outline" className="justify-start gap-2 rounded-xl" onClick={() => withTrack("x", () => openWindow(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`))}>
        <BrandDot text="X" bgClass="bg-black" />
        X / Twitter
      </Button>

      <Button variant="outline" className="justify-start gap-2 rounded-xl" onClick={() => withTrack("telegram", () => openWindow(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`))}>
        <BrandDot text="Tg" bgClass="bg-sky-500" />
        Telegram
      </Button>

      <Button
        variant="outline"
        className="justify-start gap-2 rounded-xl"
        onClick={() =>
          withTrack("email", () => {
            window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(payloadText)}`;
          })
        }
      >
        <BrandDot text="@" bgClass="bg-indigo-600" />
        Email
      </Button>

      <Button
        variant="outline"
        className="justify-start gap-2 rounded-xl"
        onClick={() => withTrack("facebook", () => openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`))}
      >
        <BrandDot text="f" bgClass="bg-blue-600" />
        Facebook
      </Button>

      <Button
        variant="outline"
        className="justify-start gap-2 rounded-xl"
        onClick={() =>
          withTrack("linkedin", () =>
            openWindow(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`),
          )
        }
      >
        <BrandDot text="in" bgClass="bg-blue-700" />
        LinkedIn
      </Button>

      <Button
        variant="outline"
        className="justify-start gap-2 rounded-xl"
        onClick={() =>
          withTrack("reddit", () =>
            openWindow(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`),
          )
        }
      >
        <BrandDot text="r/" bgClass="bg-orange-500" />
        Reddit
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4">
        <DrawerHeader>
          <DrawerTitle>Share Post</DrawerTitle>
          <DrawerDescription className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Shares: {shareCount}
          </DrawerDescription>
        </DrawerHeader>
        <div className="mb-2 rounded-xl border bg-muted/30 p-2 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Post Link</div>
          <div className="truncate font-mono">{url}</div>
        </div>
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
          <DialogDescription className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Shares: {shareCount}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border bg-muted/30 p-2 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-2"><Copy className="h-3.5 w-3.5" /> Shareable Link</div>
          <div className="truncate font-mono">{url}</div>
        </div>
        {shareOptions}
      </DialogContent>
    </Dialog>
  );
}
