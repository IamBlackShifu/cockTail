import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicCreatorProfile } from "@/lib/server/creator-store";

export const dynamic = "force-dynamic";
export default async function CreatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const profile = publicCreatorProfile((await params).slug);
  if (!profile) notFound();
  return <main className="creator-page"><header><Link href="/"><Image src="/tipsygo-logo-v2.png" alt="TIPSYGO" width={2048} height={768} priority /></Link><Link href="/#community">Community creations</Link></header><section className="creator-hero"><p className="eyebrow">TipsyGo creator</p><h1>{profile.displayName}</h1><div><span><strong>{profile.mixCount}</strong> published mixes</span><span><strong>{profile.orderCount}</strong> community orders</span><span><strong>{profile.likeCount}</strong> likes</span></div></section><section className="creator-mixes"><h2>Creations by<br /><em>{profile.displayName}</em></h2><div className="community-grid">{profile.creations?.map((creation, index) => <article key={creation.id}><div className="community-art"><span>{creation.featured ? "TipsyGo pick" : `${creation.orderCount} orders`}</span><b>✦</b><small>{String(index + 1).padStart(2, "0")}</small></div><h3>{creation.name}</h3><p>{Object.values(creation.choices).join(" · ")}</p><div><strong>${(creation.unitCents / 100).toFixed(2)}</strong>{creation.shareSlug && <Link href={`/mix/${creation.shareSlug}`}>View mix →</Link>}</div></article>)}</div></section></main>;
}
