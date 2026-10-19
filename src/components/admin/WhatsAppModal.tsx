import { useEffect, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { waUrlTo } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type WhatsAppDraft = {
  phone: string;
  message: string;
  customerName?: string;
};

export function WhatsAppModal({
  draft,
  onClose,
  onSend,
}: {
  draft: WhatsAppDraft | null;
  onClose: () => void;
  onSend?: (message: string) => void;
}) {
  const [text, setText] = useState(draft?.message ?? "");

  useEffect(() => {
    if (draft) setText(draft.message);
  }, [draft]);

  if (!draft) return null;
  const url = waUrlTo(draft.phone, text);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Message WhatsApp</DialogTitle>
          <DialogDescription>
            À envoyer à {draft.customerName ?? "ce client"} — {draft.phone}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          className="font-sans text-sm"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                toast.success("Message copié.");
              } catch {
                toast.error("Copie impossible sur ce navigateur.");
              }
            }}
          >
            <Copy /> Copier
          </Button>
          <Button asChild>
            <a href={url} target="_blank" rel="noreferrer" onClick={() => onSend?.(text)}>
              <MessageCircle /> Ouvrir WhatsApp
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
