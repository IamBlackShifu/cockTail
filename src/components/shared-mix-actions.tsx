"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SavedCreation } from "@/lib/orders";

const CART_KEY = "tipsygo-cart-v1";
const CREATOR_KEY = "tipsygo-creator-key-v1";
const REMIX_KEY = "tipsygo-remix-v1";

function ownerKey() {
  const existing = localStorage.getItem(CREATOR_KEY);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const created = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(CREATOR_KEY, created);
  return created;
}

export function SharedMixActions({ creation }: { creation: SavedCreation }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const recipe = Object.values(creation.choices).join(" · ");
  const add = () => {
    let cart: unknown[] = [];
    try { const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); if (Array.isArray(parsed)) cart = parsed; } catch {}
    const count = cart.reduce<number>((sum, raw) => sum + (raw && typeof raw === "object" && "selection" in raw && raw.selection && typeof raw.selection === "object" && "quantity" in raw.selection ? Number(raw.selection.quantity) || 0 : 0), 0);
    if (count >= 40) { setMessage("Your bag is full. Remove a drink before adding this mix."); return; }
    cart.push({ id: -1, name: creation.name, note: recipe, price: creation.unitCents / 100, category: "Community creation", image: "/tipsygo-logo-v2.png", strength: "Your way", tone: "sunset", customization: recipe, selection: { cocktailId: -1, quantity: 1, choices: creation.choices, creationName: creation.name, creatorKey: ownerKey(), sourceCreationId: creation.id } });
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    router.push("/#cart");
  };
  const remix = () => {
    sessionStorage.setItem(REMIX_KEY, JSON.stringify({ name: creation.name, choices: creation.choices }));
    router.push("/?remix=1");
  };
  const copy = async () => { await navigator.clipboard.writeText(window.location.href); setMessage("Link copied."); };
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${creation.name}, a cocktail on TipsyGo: ${window.location.href}`)}`, "_blank", "noopener,noreferrer");
  return <div className="shared-mix-actions"><button className="primary-button" onClick={add}>Try this mix <span>→</span></button><button className="outline-button" onClick={remix}>Remix it <span>✦</span></button><div className="share-row"><button onClick={whatsapp}>Share on WhatsApp</button><button onClick={copy}>Copy link</button></div>{message && <p role="status">{message}</p>}</div>;
}
