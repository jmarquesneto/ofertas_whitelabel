"use client";
import { useEffect, useState } from "react";
import { Check, Link2, Send } from "lucide-react";

/** Compartilhar: WhatsApp com texto pronto + copiar link */
export function ShareButtons({ url, title, price, coupon }: { url: string; title: string; price: string | null; coupon: string | null }) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(url);
  useEffect(() => {
    if (!url.startsWith("http")) setLink(window.location.origin + url);
  }, [url]);
  const text = [`🔥 ${title}`, price && `💰 ${price}`, coupon && `🎟️ Cupom: ${coupon}`, `👉 ${link}`].filter(Boolean).join("\n");
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener"
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-secondary py-3 text-sm font-bold text-secondary transition hover:bg-secondary hover:text-secondary-fg">
        <Send className="h-4 w-4" /> WhatsApp
      </a>
      <button type="button"
        onClick={async () => { try { await navigator.clipboard.writeText(link); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1800); }}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-secondary py-3 text-sm font-bold text-secondary transition hover:bg-secondary hover:text-secondary-fg">
        {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Link2 className="h-4 w-4" /> Copiar link</>}
      </button>
    </div>
  );
}
