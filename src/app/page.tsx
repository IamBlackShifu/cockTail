"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { options, customizationGroups, defaultCustomization, flavourIndicators, recommendCocktails, type BuilderOptions, type Cocktail, type Customization, type FlavourIndicator } from "@/lib/catalog";
import type { CommunityChallenge, OrderItemInput, SavedCreation, StoreSettings } from "@/lib/orders";
import { Checkout } from "@/components/checkout";
import { OrderTracker } from "@/components/order-tracker";
type CartItem = Cocktail & { customization?: string; selection: OrderItemInput };
const flavourIcons: Record<FlavourIndicator, string> = { Sweet: "◆", Sour: "◒", Smoky: "≋", Creamy: "●", Strong: "⚡" };
const CART_STORAGE_KEY = "tipsygo-cart-v1";
const CREATOR_STORAGE_KEY = "tipsygo-creator-key-v1";
const REMIX_STORAGE_KEY = "tipsygo-remix-v1";
const FAVOURITES_STORAGE_KEY = "tipsygo-favourites-v1";

function creatorKey() {
  const existing = window.localStorage.getItem(CREATOR_STORAGE_KEY);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const created = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  window.localStorage.setItem(CREATOR_STORAGE_KEY, created);
  return created;
}

function savedCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const items = value.filter((item): item is CartItem => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<CartItem>;
    return Number.isInteger(candidate.id) && typeof candidate.name === "string" && candidate.name.length <= 120 && typeof candidate.note === "string" && typeof candidate.category === "string" && typeof candidate.image === "string" && typeof candidate.strength === "string" && typeof candidate.tone === "string" && typeof candidate.price === "number" && Number.isFinite(candidate.price) && candidate.price >= 0 && candidate.price <= 1000 && !!candidate.selection && Number.isInteger(candidate.selection.quantity) && candidate.selection.quantity >= 1 && candidate.selection.quantity <= 20 && typeof candidate.selection.choices === "object";
  }).slice(0, 40);
  let remaining = 40;
  return items.flatMap(item => {
    if (remaining < 1) return [];
    const quantity = Math.min(item.selection.quantity, remaining);
    remaining -= quantity;
    return [{ ...item, selection: { ...item.selection, quantity } }];
  });
}

export default function Home() {
  const [cocktails, setCocktails] = useState<Cocktail[]>([]);
  const [menuCategories, setMenuCategories] = useState<string[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [category, setCategory] = useState("All sips");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [favourites, setFavourites] = useState<number[]>([]);
  const [favouritesReady, setFavouritesReady] = useState(false);
  const [customizing, setCustomizing] = useState<Cocktail | null>(null);
  const [customization, setCustomization] = useState<Customization>(defaultCustomization);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState(0);
  const [builderOptions, setBuilderOptions] = useState<BuilderOptions>(options);
  const [builder, setBuilder] = useState({ spirit: options.spirit[0], mixer: options.mixer[0], finish: options.finish[0] });
  const [creationName, setCreationName] = useState("");
  const [showCreations, setShowCreations] = useState(false);
  const [creations, setCreations] = useState<SavedCreation[]>([]);
  const [community, setCommunity] = useState<SavedCreation[]>([]);
  const [challenge, setChallenge] = useState<CommunityChallenge | null>(null);
  const [creationsLoading, setCreationsLoading] = useState(false);
  const [creationsError, setCreationsError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorProfileMessage, setCreatorProfileMessage] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [bagMessage, setBagMessage] = useState("");
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ acceptingOrders: true, deliveryEnabled: true, pickupEnabled: true, notice: "", whatsappNumber: "", updatedAt: "" });
  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(CART_STORAGE_KEY);
        if (stored) setCart(savedCart(JSON.parse(stored)));
      } catch {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      } finally {
        setCartReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);
  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(FAVOURITES_STORAGE_KEY) || "[]");
        if (Array.isArray(stored)) setFavourites([...new Set(stored.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, 100));
      } catch {
        window.localStorage.removeItem(FAVOURITES_STORAGE_KEY);
      } finally {
        setFavouritesReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);
  useEffect(() => {
    if (!favouritesReady) return;
    if (favourites.length) window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(favourites));
    else window.localStorage.removeItem(FAVOURITES_STORAGE_KEY);
  }, [favourites, favouritesReady]);
  useEffect(() => {
    const loadCommunity = window.setTimeout(() => { void fetch("/api/community", { cache: "no-store", headers: { "X-Creator-Key": creatorKey() } }).then(response => response.json()).then(result => { setCommunity(result.creations || []); setChallenge(result.challenge || null); }).catch(() => undefined); }, 0);
    return () => window.clearTimeout(loadCommunity);
  }, []);
  useEffect(() => {
    if (!cartReady) return;
    if (cart.length) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    else window.localStorage.removeItem(CART_STORAGE_KEY);
  }, [cart, cartReady]);
  useEffect(() => {
    const restoreRemix = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(REMIX_STORAGE_KEY);
        if (!raw) return;
        const remix = JSON.parse(raw) as { name?: unknown; choices?: Record<string, unknown> };
        if (typeof remix.name !== "string" || !remix.choices) return;
        const spirit = builderOptions.spirit.find(item => item.label === remix.choices?.spirit);
        const mixer = builderOptions.mixer.find(item => item.label === remix.choices?.mixer);
        const finish = builderOptions.finish.find(item => item.label === remix.choices?.finish);
        if (!spirit || !mixer || !finish) return;
        setBuilder({ spirit, mixer, finish }); setCreationName(`${remix.name} Remix`.slice(0, 60)); setBuilderStep(0); setShowBuilder(true);
      } catch {} finally { window.sessionStorage.removeItem(REMIX_STORAGE_KEY); }
    }, 0);
    return () => window.clearTimeout(restoreRemix);
  }, [builderOptions]);
  useEffect(() => {
    const confirmed = () => { window.localStorage.removeItem(CART_STORAGE_KEY); setCart([]); setShowCheckout(false); };
    window.addEventListener("tipsygo-order", confirmed);
    const controller = new AbortController();
    const loadMenu = () => fetch("/api/products", { cache: "no-store", signal: controller.signal })
        .then(async response => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "The menu is unavailable.");
          setCocktails(result.products); setMenuCategories(result.categories || []); setMenuError("");
        })
        .catch(error => { if (error.name !== "AbortError") setMenuError("We couldn’t load the current menu. Please refresh and try again."); })
        .finally(() => setMenuLoading(false));
    void loadMenu();
    void fetch("/api/store", { cache: "no-store", signal: controller.signal }).then(response => response.json()).then(result => { if (result.settings) setStoreSettings(result.settings); }).catch(() => undefined);
    void fetch("/api/ingredients", { cache: "no-store", signal: controller.signal }).then(response => response.json()).then(result => { const next = result.options as BuilderOptions; if (!next?.spirit?.length || !next?.mixer?.length || !next?.finish?.length) return; setBuilderOptions(next); setBuilder(current => ({ spirit: next.spirit.find(item => item.label === current.spirit.label) || next.spirit[0], mixer: next.mixer.find(item => item.label === current.mixer.label) || next.mixer[0], finish: next.finish.find(item => item.label === current.finish.label) || next.finish[0] })); }).catch(() => undefined);
    const refreshMenu = () => { if (!document.hidden) void loadMenu(); };
    const interval = setInterval(refreshMenu, 30000);
    window.addEventListener("focus", refreshMenu);
    return () => { controller.abort(); clearInterval(interval); window.removeEventListener("focus", refreshMenu); window.removeEventListener("tipsygo-order", confirmed); };
  }, []);
  const [showAccount, setShowAccount] = useState(false);
  const categories = useMemo(() => ["All sips", "Favourites", ...menuCategories.filter(item => cocktails.some(drink => drink.category === item))], [cocktails, menuCategories]);
  const filteredCocktails = useMemo(() => cocktails.filter((drink) => (category === "All sips" || (category === "Favourites" ? favourites.includes(drink.id) : drink.category === category)) && `${drink.name} ${drink.note} ${drink.description}`.toLowerCase().includes(query.toLowerCase())), [cocktails, category, favourites, query]);
  const recommendations = useMemo(() => customizing ? recommendCocktails(customizing, cocktails) : [], [cocktails, customizing]);
  const builderPrice = 14 + builder.spirit.price + builder.mixer.price + builder.finish.price;
  const customizationPrice = customizing ? customizing.price + Object.values(customization).reduce((sum, option) => sum + option.price, 0) : 0;
  const bagCount = cart.reduce((sum, item) => sum + item.selection.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.selection.quantity, 0);
  const openCustomization = (drink: Cocktail, cartIndex: number | null = null) => {
    setEditingCartIndex(cartIndex);
    const savedChoices = cartIndex === null ? {} : (drink as CartItem).selection.choices;
    setCustomization(cartIndex === null ? defaultCustomization : Object.fromEntries(customizationGroups.map(group => [group.key, group.options.find(option => option.label === savedChoices[group.key]) || defaultCustomization[group.key]])) as Customization);
    setCustomizing(drink);
  };
  const announceAdded = (name: string) => { setBagMessage(`${name} added to your bag.`); window.setTimeout(() => setBagMessage(""), 3000); };
  const toggleFavourite = (drink: Cocktail) => {
    const saved = favourites.includes(drink.id);
    setFavourites(current => saved ? current.filter(id => id !== drink.id) : [...current, drink.id]);
    setBagMessage(saved ? `${drink.name} removed from your favourites.` : `${drink.name} saved to your favourites.`);
    window.setTimeout(() => setBagMessage(""), 3000);
  };
  const addCustomizedDrink = () => { if (!customizing || (editingCartIndex === null && bagCount >= 40)) return; const summary = Object.values(customization).map((option) => option.label).filter((label) => !["Classic", "Normal", "Standard", "Normal ice", "Nothing extra"].includes(label)).join(" · "); const name = customizing.name; const updated = { ...customizing, price: customizationPrice, note: summary || customizing.note, customization: summary || "Classic build", selection: { cocktailId: customizing.id, quantity: editingCartIndex === null ? 1 : cart[editingCartIndex]?.selection.quantity || 1, choices: Object.fromEntries(Object.entries(customization).map(([key, option]) => [key, option.label])) } }; setCart((current) => editingCartIndex === null ? [...current, updated] : current.map((item, index) => index === editingCartIndex ? updated : item)); setCustomizing(null); setEditingCartIndex(null); announceAdded(editingCartIndex === null ? name : `${name} updated`); };
  const changeQuantity = (index: number, change: number) => setCart(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, selection: { ...item.selection, quantity: Math.max(1, Math.min(20, item.selection.quantity + change)) } } : item));
  const openCreations = async () => {
    setShowCreations(true); setCreationsLoading(true); setCreationsError("");
    try {
      const key = creatorKey();
      const [response, profileResponse] = await Promise.all([fetch("/api/creations", { cache: "no-store", headers: { "X-Creator-Key": key } }), fetch("/api/creator-profile", { cache: "no-store", headers: { "X-Creator-Key": key } })]);
      const result = await response.json(); const profileResult = await profileResponse.json();
      if (!response.ok) throw new Error(result.error || "Your creations could not be loaded.");
      setCreations(result.creations); setCreatorName(profileResult.profile?.displayName || ""); const rewards = (result.creations as SavedCreation[]).filter(item => item.rewardCode).map(item => `${item.name}: ${item.rewardCode}`); setCreatorProfileMessage(rewards.length ? `Your creator rewards — ${rewards.join(" · ")} (10% off, valid for 30 days)` : "");
    } catch (error) { setCreationsError(error instanceof Error ? error.message : "Your creations could not be loaded."); }
    finally { setCreationsLoading(false); }
  };
  const saveCreatorProfile = async () => { setCreatorProfileMessage(""); setCreationsError(""); try { const response = await fetch("/api/creator-profile", { method: "PATCH", headers: { "Content-Type": "application/json", "X-Creator-Key": creatorKey() }, body: JSON.stringify({ displayName: creatorName }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setCreatorName(result.profile.displayName); setCreatorProfileMessage(`Public creator name saved. Your profile is tipsygo.pro/creator/${result.profile.slug}`); } catch (error) { setCreationsError(error instanceof Error ? error.message : "Creator profile could not be saved."); } };
  const reorderCreation = (creation: SavedCreation) => {
    if (bagCount >= 40) return;
    const labels = Object.values(creation.choices);
    setCart(current => [...current, { id: -1, name: creation.name, note: labels.join(" · "), description: "Your saved custom cocktail, mixed exactly as you created it.", price: creation.unitCents / 100, category: "Your creations", image: cocktails[0]?.image || "", strength: "Your way", tone: "sunset", customization: labels.join(" · "), selection: { cocktailId: -1, quantity: 1, choices: creation.choices, creationName: creation.name, creatorKey: creatorKey(), creationId: creation.id } }]);
    setShowCreations(false); announceAdded(creation.name);
  };
  const sharedUrl = async (creation: SavedCreation) => {
    if (creation.shareSlug) return `${window.location.origin}/mix/${creation.shareSlug}`;
    const response = await fetch(`/api/creations/${creation.id}/share`, { method: "POST", headers: { "X-Creator-Key": creatorKey() } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "This mix could not be shared.");
    setCreations(current => current.map(item => item.id === creation.id ? result.creation : item));
    return `${window.location.origin}/mix/${result.creation.shareSlug}`;
  };
  const shareCreation = async (creation: SavedCreation, channel: "copy" | "whatsapp") => {
    setShareMessage("");
    try {
      const url = await sharedUrl(creation);
      if (channel === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${creation.name}, my cocktail on TipsyGo: ${url}`)}`, "_blank", "noopener,noreferrer");
      else { await navigator.clipboard.writeText(url); setShareMessage(`Link copied for ${creation.name}.`); }
    } catch (error) { setCreationsError(error instanceof Error ? error.message : "This mix could not be shared."); }
  };
  const submitCommunity = async (creation: SavedCreation) => {
    setShareMessage(""); setCreationsError("");
    try { const response = await fetch(`/api/creations/${creation.id}/submit`, { method: "POST", headers: { "X-Creator-Key": creatorKey() } }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setCreations(current => current.map(item => item.id === creation.id ? result.creation : item)); setShareMessage(`${creation.name} was sent to the TipsyGo team for review.`); }
    catch (error) { setCreationsError(error instanceof Error ? error.message : "This mix could not be submitted."); }
  };
  const addCommunityCreation = (creation: SavedCreation) => {
    if (bagCount >= 40) return;
    const recipe = Object.values(creation.choices).join(" · ");
    setCart(current => [...current, { id: -1, name: creation.name, note: recipe, description: "A community-created cocktail ready for you to discover.", price: creation.unitCents / 100, category: "Community creations", image: "/tipsygo-logo-v2.png", strength: "Community", tone: "sunset", customization: recipe, selection: { cocktailId: -1, quantity: 1, choices: creation.choices, creationName: creation.name, creatorKey: creatorKey(), sourceCreationId: creation.id } }]);
    announceAdded(creation.name);
  };
  const toggleCommunityLike = async (creation: SavedCreation) => {
    try { const response = await fetch(`/api/community/${creation.id}/like`, { method: "POST", headers: { "X-Creator-Key": creatorKey() } }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setCommunity(current => current.map(item => item.id === creation.id ? { ...item, ...result } : item).sort((a, b) => Number(b.featured) - Number(a.featured) || b.likeCount - a.likeCount || b.orderCount - a.orderCount)); }
    catch { setBagMessage("We couldn't save that like. Please try again."); }
  };
  const addBuilderCreation = () => {
    const name = creationName.trim();
    if (name.length < 2 || name.length > 60 || bagCount >= 40) return;
    const choices = Object.fromEntries(Object.entries(builder).map(([key, option]) => [key, option.label]));
    const recipe = Object.values(builder).map(option => option.label).join(" · ");
    setCart(current => [...current, { id: -1, name, note: recipe, description: "Your original cocktail, built from scratch and made your way.", price: builderPrice, category: "Your creations", image: cocktails[0]?.image || "", strength: "Your way", tone: "sunset", customization: recipe, selection: { cocktailId: -1, quantity: 1, choices, creationName: name, creatorKey: creatorKey() } }]);
    setShowBuilder(false); setCreationName(""); announceAdded(name);
  };
  return (
    <main className="site-shell">
        {(!storeSettings.acceptingOrders || storeSettings.notice) && <div className={storeSettings.acceptingOrders ? "storefront-notice" : "storefront-notice paused"}><strong>{storeSettings.acceptingOrders ? "Service update" : "Ordering paused"}</strong><span>{storeSettings.notice || "TipsyGo is not accepting new orders right now. Please check back soon."}</span></div>}
        <header className="topbar"><a className="brand brand-logo" href="#top" aria-label="Tipsygo home"><Image src="/tipsygo-logo-v2.png" alt="TIPSYGO" width={2048} height={768} priority /></a><nav className="desktop-nav" aria-label="Main navigation"><a href="#menu">Explore</a><a href="#how-it-works">How it works</a><a href="#reorder">Create a drink</a></nav><div className="header-actions"><button className="my-mixes-button" onClick={openCreations}>My mixes</button><button className="icon-button" aria-label="Search" onClick={() => document.getElementById("search")?.focus()}>⌕</button><button className="cart-button" onClick={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth" })}>Bag <span>{bagCount}</span></button><button className="avatar" aria-label="View your orders" onClick={() => setShowAccount(true)}>S</button></div></header>
        <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow">Cocktails on demand <span>•</span> Delivered in 30 min</p><h1>Your night.<br /><em>Your mix.</em><br />Delivered.</h1><p className="hero-description">Bar-quality cocktails, built exactly how you like them. From our menu or straight from your imagination.</p><div className="hero-actions"><a className="primary-button" href="#menu">Order a cocktail <span>↗</span></a><button className="outline-button" onClick={() => (setBuilderStep(0), setShowBuilder(true))}>Build your own <span>✦</span></button></div><div className="hero-proof"><div className="faces"><span>✦</span><span>J</span><span>M</span></div><p><strong>4.9/5</strong> from 2,000+ happy sippers</p></div></div><div className="hero-art" aria-label="Pink cocktail with citrus garnish" role="img"><div className="hero-art-label">Made for<br /><strong>golden hour</strong></div><div className="hero-sticker">HAND<br />CRAFTED</div></div></section>
        <section className="builder-banner" id="reorder"><div className="builder-mark-large">✦</div><div><p className="eyebrow">The signature TIPSYGO experience</p><h2>Don&apos;t just order.<br /><em>Make it yours.</em></h2><p>Choose your spirit, mood, finish and extras. Give it a name. We&apos;ll make it a classic.</p></div><button className="dark-button" onClick={() => (setBuilderStep(0), setShowBuilder(true))}>Build your cocktail <span>→</span></button><div className="banner-scribble">YOU<br />MAKE<br />THE<br /><em>RULES</em></div></section>
        <section className="menu-section" id="menu">
          <div className="section-heading"><div><p className="eyebrow">TipsyGo signatures</p><h2>Meet the<br /><em>house lineup.</em></h2></div><div className="search-wrap"><span>⌕</span><input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names or flavours" aria-label="Search cocktails" /></div></div>
          {!menuLoading && !menuError && <div className="category-row" role="tablist">{categories.map((item) => <button key={item} className={category === item ? "category active" : "category"} onClick={() => setCategory(item)}>{item}{item === "Favourites" && <span className="favourite-count">{favourites.length}</span>}</button>)}</div>}
          {menuLoading && <p className="empty-state" role="status">Mixing up today’s menu…</p>}{menuError && <p className="flow-error" role="alert">{menuError}</p>}
          <div className="cocktail-grid">{filteredCocktails.map((drink, index) => <article className={drink.available === false ? "cocktail-card sold-out" : "cocktail-card"} key={drink.id}>
            <div className={`drink-image ${drink.tone}`} style={{ backgroundImage: `url(${drink.image})` }}>{drink.featured && <span className="featured-pill">Featured</span>}{drink.available === false && <span className="sold-out-pill">Sold out</span>}<span className="strength-pill">{drink.strength}</span><button className={favourites.includes(drink.id) ? "favorite saved" : "favorite"} aria-label={`${favourites.includes(drink.id) ? "Remove" : "Add"} ${drink.name} ${favourites.includes(drink.id) ? "from" : "to"} favourites`} aria-pressed={favourites.includes(drink.id)} onClick={() => toggleFavourite(drink)}>{favourites.includes(drink.id) ? "♥" : "♡"}</button><span className="image-number">{String(index + 1).padStart(2, "0")}</span></div>
            <div className="drink-meta"><div><h3>{drink.name}</h3><p>{drink.note}</p></div><strong>${drink.price.toFixed(2)}</strong></div><div className="flavour-row" aria-label={`${drink.name} flavour profile`}>{flavourIndicators(drink).map(indicator => <span className={`flavour-badge ${indicator.toLowerCase()}`} key={indicator}><span aria-hidden="true">{flavourIcons[indicator]}</span>{indicator}</span>)}</div><p className="drink-description">{drink.description}</p>
            <button className="add-button" disabled={drink.available === false} onClick={() => openCustomization(drink)}>{drink.available === false ? "Currently unavailable" : "Customize & add"} <span>{drink.available === false ? "—" : "+"}</span></button>
          </article>)}</div>
          {!menuLoading && !menuError && filteredCocktails.length === 0 && <p className="empty-state">{category === "Favourites" ? "No favourites yet. Tap the heart on a cocktail to save it here." : "No sips found. Try a different mood."}</p>}<div className="view-all"><button onClick={() => { setCategory("All sips"); setQuery(""); }}>View all cocktails <span>→</span></button></div>
        </section>
        {community.length > 0 && <section className="community-section" id="community">{challenge?.active && <div className="challenge-banner"><div><p className="eyebrow">This week’s challenge</p><h3>{challenge.title}</h3><p>{challenge.description}</p></div><span>7-day leaderboard</span></div>}<div className="section-heading"><div><p className="eyebrow">Trending this week</p><h2>Community<br /><em>creations.</em></h2></div><p>Ranked by orders and likes from the last seven days. Orders carry extra weight.</p></div><div className="community-grid">{community.map((creation, index) => <article className={creation.available === false ? "unavailable" : ""} key={creation.id}><div className="community-art"><span>{creation.available === false ? "Currently unavailable" : creation.challengeBadge || creation.featured ? creation.challengeBadge || "TipsyGo pick" : `Trending #${creation.trendingRank}`}</span><button className={creation.liked ? "community-like liked" : "community-like"} aria-label={`${creation.liked ? "Unlike" : "Like"} ${creation.name}`} onClick={() => toggleCommunityLike(creation)}>♥ {creation.likeCount}</button><b>✦</b><small>{String(index + 1).padStart(2, "0")}</small></div><h3>{creation.name}</h3>{creation.creatorName && creation.creatorSlug && <a className="creator-credit" href={`/creator/${creation.creatorSlug}`}>by {creation.creatorName}</a>}<p>{Object.values(creation.choices).join(" · ")}</p><p className="weekly-stats">This week: {creation.weeklyOrders || 0} orders · {creation.weeklyLikes || 0} likes</p><div><strong>${(creation.unitCents / 100).toFixed(2)}</strong><button onClick={() => addCommunityCreation(creation)} disabled={bagCount >= 40 || creation.available === false}>{creation.available === false ? "Sold out" : "Try this mix +"}</button></div></article>)}</div></section>}
        <section className="how-section" id="how-it-works"><p className="eyebrow">Good times, made easy</p><h2>From our bar<br /><em>to your door.</em></h2><div className="steps"><div><span>01</span><h3>Pick your vibe</h3><p>Choose from classics, signatures or mood-based sips.</p></div><div><span>02</span><h3>Make it yours</h3><p>Customise the details that make your drink, yours.</p></div><div><span>03</span><h3>We make the magic</h3><p>Freshly mixed, packed with care, at your door in 30.</p></div></div></section>
        <aside className="cart-drawer" id="cart"><div><p className="eyebrow">Your order</p><h2>In the bag <span>{bagCount} {bagCount === 1 ? "drink" : "drinks"}</span></h2></div>{cart.length ? <><div className="cart-items">{cart.map((drink, index) => <div className="cart-item" key={`${drink.id}-${index}`}><div className={`mini-image ${drink.tone}`} style={{ backgroundImage: `url(${drink.image})` }} /><div className="cart-item-copy"><strong>{drink.name}</strong><p>{drink.customization || "Classic build"}</p>{drink.id !== -1 && <button className="edit-options" onClick={() => openCustomization(drink, index)}>Edit options</button>}<div className="quantity-control" aria-label={`Quantity for ${drink.name}`}><button aria-label={`Decrease ${drink.name} quantity`} disabled={drink.selection.quantity === 1} onClick={() => changeQuantity(index, -1)}>−</button><span aria-live="polite">{drink.selection.quantity}</span><button aria-label={`Increase ${drink.name} quantity`} disabled={drink.selection.quantity === 20 || bagCount === 40} onClick={() => changeQuantity(index, 1)}>+</button></div></div><div className="cart-item-actions"><strong>${(drink.price * drink.selection.quantity).toFixed(2)}</strong><small>${drink.price.toFixed(2)} each</small><button aria-label={`Remove ${drink.name} from bag`} onClick={() => setCart(current => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div></div>)}</div>{bagCount === 40 && <p className="bag-limit" role="status">Maximum order size reached. Remove a drink to add another.</p>}<div className="cart-total"><span>Subtotal · {bagCount} {bagCount === 1 ? "drink" : "drinks"}</span><strong>${subtotal.toFixed(2)}</strong></div><button className="primary-button checkout" onClick={() => setShowCheckout(true)}>Checkout <span>→</span></button></> : <p className="cart-empty">Your next good decision starts here.</p>}</aside>
        <div className={bagMessage ? "bag-toast visible" : "bag-toast"} role="status" aria-live="polite">{bagMessage}<button onClick={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth" })}>View bag</button></div>
        <OrderTracker />
        {showAccount && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Your orders"><div className="checkout-modal"><button className="modal-close" onClick={() => setShowAccount(false)} aria-label="Close orders">×</button><p className="eyebrow">Your orders</p><h2>Keep an eye<br /><em>on your mix.</em></h2><p>Your latest order is saved in this browser. Scroll to the order tracker for updates from the team.</p><button className="dark-button" onClick={() => { setShowAccount(false); document.getElementById("order-status")?.scrollIntoView({ behavior: "smooth" }); }}>View latest order</button></div></div>}
        {showCreations && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="My creations"><div className="checkout-modal creations-modal"><button className="modal-close" onClick={() => setShowCreations(false)} aria-label="Close creations">×</button><p className="eyebrow">Your private recipe book</p><h2>My <em>creations.</em></h2><div className="creator-profile-editor"><label>Public creator name<input minLength={2} maxLength={40} value={creatorName} onChange={event => setCreatorName(event.target.value)} placeholder="e.g. Tasha the Mixer" /></label><button onClick={saveCreatorProfile}>Save creator name</button></div>{creatorProfileMessage && <p className="flow-hint" role="status">{creatorProfileMessage}</p>}{creationsLoading && <p role="status">Loading your mixes…</p>}{creationsError && <p className="flow-error" role="alert">{creationsError}</p>}{shareMessage && <p className="flow-hint" role="status">{shareMessage}</p>}{!creationsLoading && !creationsError && !creations.length && <div className="empty-creations"><p>Name and order a cocktail from the builder. It will appear here after checkout.</p><button className="dark-button" onClick={() => { setShowCreations(false); setBuilderStep(0); setCreationName(""); setShowBuilder(true); }}>Create your first mix</button></div>}<div className="creation-list">{creations.map(creation => <article key={creation.id}><div><span>{creation.orderCount} order{creation.orderCount === 1 ? "" : "s"}</span><h3>{creation.name}</h3><p>{Object.values(creation.choices).join(" · ")}</p></div><div><strong>${(creation.unitCents / 100).toFixed(2)}</strong><small>{creation.moderationStatus === "private" ? "Private" : creation.moderationStatus === "submitted" ? "In review" : creation.moderationStatus}</small><button onClick={() => reorderCreation(creation)} disabled={bagCount >= 40}>Add to bag</button>{["private", "rejected", "hidden"].includes(creation.moderationStatus) && <button className="submit-mix" onClick={() => submitCommunity(creation)}>Submit to menu</button>}<button className="share-mix" onClick={() => shareCreation(creation, "copy")}>Copy link</button><button className="share-mix" onClick={() => shareCreation(creation, "whatsapp")}>WhatsApp</button></div></article>)}</div></div></div>}
        {showCheckout && <Checkout items={cart.map(item => item.selection)} subtotalCents={Math.round(subtotal * 100)} settings={storeSettings} onClose={() => setShowCheckout(false)} onPlaced={() => { setCart([]); setShowCheckout(false); setTimeout(() => document.getElementById("order-status")?.scrollIntoView({ behavior: "smooth" }), 200); }} />}
        {customizing && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Customize ${customizing.name}`}>
          <div className="customize-modal detail-customizer">
            <button className="modal-close" onClick={() => { setCustomizing(null); setEditingCartIndex(null); }} aria-label="Close customization">×</button>
            <div className="customize-hero">
              <div className={`customize-image ${customizing.tone}`} style={{ backgroundImage: `url(${customizing.image})` }} />
              <div className="customize-copy">
                <p className="eyebrow">{editingCartIndex === null ? "Make it yours" : "Update your drink"} <span>✦</span></p>
                <h2>{customizing.name}</h2>
                <div className="flavour-row modal-flavours" aria-label={`${customizing.name} flavour profile`}>{flavourIndicators(customizing).map(indicator => <span className={`flavour-badge ${indicator.toLowerCase()}`} key={indicator}><span aria-hidden="true">{flavourIcons[indicator]}</span>{indicator}</span>)}</div>
                <p className="customize-description">{customizing.description}</p>
                <div className="customize-recipe"><span>Made with</span><p>{customizing.note}</p></div>
                <p className="customize-base-price">Classic build <strong>${customizing.price.toFixed(2)}</strong></p>
              </div>
            </div>
            <div className="customize-section-heading"><div><p className="eyebrow">Personalize your pour</p><h3>Choose your details</h3></div><span>Optional upgrades update your total instantly.</span></div>
            <div className="custom-groups">{customizationGroups.map((group, groupIndex) => <fieldset className="custom-group" key={group.key}><legend><span>{String(groupIndex + 1).padStart(2, "0")}</span>{group.label}</legend><div className="custom-options">{group.options.map((item) => <button type="button" key={item.label} aria-pressed={customization[group.key].label === item.label} className={customization[group.key].label === item.label ? "custom-option selected" : "custom-option"} onClick={() => setCustomization((current) => ({ ...current, [group.key]: item }))}><span className="option-check" aria-hidden="true">{customization[group.key].label === item.label ? "✓" : ""}</span><span className="option-label">{item.label}</span>{item.price > 0 && <span className="option-price">+${item.price}</span>}</button>)}</div></fieldset>)}</div>
            {recommendations.length > 0 && <section className="cocktail-recommendations"><div><p className="eyebrow">You may also like</p><h3>More for your mood</h3></div><div className="recommendation-grid">{recommendations.map(drink => <button type="button" key={drink.id} onClick={() => openCustomization(drink)}><span className="recommendation-image" style={{ backgroundImage: `url(${drink.image})` }} /><span><strong>{drink.name}</strong><small>{flavourIndicators(drink).join(" · ")}</small></span><b>${drink.price.toFixed(2)}</b></button>)}</div></section>}
            <div className="customize-footer"><div className="customize-total"><span>Classic ${customizing.price.toFixed(2)}{customizationPrice > customizing.price && ` + upgrades $${(customizationPrice - customizing.price).toFixed(2)}`}</span><strong>${customizationPrice.toFixed(2)}</strong></div><button className="dark-button" onClick={addCustomizedDrink}>{editingCartIndex === null ? "Add customized cocktail" : "Save changes"} <span>✦</span></button></div>
          </div>
        </div>}
        {showBuilder && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Build your cocktail"><div className="builder-modal"><button className="modal-close" onClick={() => setShowBuilder(false)} aria-label="Close builder">×</button><div className="builder-modal-intro"><p className="eyebrow">Build your own <span>✦</span></p><h2>Your rules.<br /><em>Your cocktail.</em></h2><div className="step-count">0{builderStep + 1} <span>/ 03</span></div></div><div className="builder-option"><p>{builderStep === 0 ? "Start with a spirit" : builderStep === 1 ? "Choose your mood" : "Finish with a flourish"}</p><div className="option-list">{(builderStep === 0 ? builderOptions.spirit : builderStep === 1 ? builderOptions.mixer : builderOptions.finish).map((item) => { const key = builderStep === 0 ? "spirit" : builderStep === 1 ? "mixer" : "finish"; return <button key={item.label} className={builder[key].label === item.label ? "option selected" : "option"} onClick={() => setBuilder((current) => ({ ...current, [key]: item }))}>{item.label}<span>{item.price ? `+$${item.price}` : "Included"}</span></button>; })}</div>{builderStep === 2 && <label className="creation-name">Name your cocktail<input aria-label="Cocktail name" required minLength={2} maxLength={60} value={creationName} onChange={event => setCreationName(event.target.value)} placeholder="e.g. Sunset Trouble" /></label>}</div><div className="builder-footer"><span>Estimated total <strong>${builderPrice.toFixed(2)}</strong></span><button className="dark-button" disabled={builderStep === 2 && (creationName.trim().length < 2 || bagCount >= 40)} onClick={() => builderStep < 2 ? setBuilderStep(builderStep + 1) : addBuilderCreation()}>{builderStep < 2 ? "Next step →" : "Name it & add to bag ✦"}</button></div></div></div>}
    </main>
  );
}
