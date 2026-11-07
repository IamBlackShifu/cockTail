import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedMixActions } from "@/components/shared-mix-actions";
import { publicCreation } from "@/lib/server/creation-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const creation = publicCreation((await params).slug);
  if (!creation) return { title: "Mix not found | TIPSYGO" };
  const description = `${creation.name}: ${Object.values(creation.choices).join(", ")}. Try or remix this community cocktail on TipsyGo.`;
  return { title: `${creation.name} | TIPSYGO`, description, openGraph: { title: `${creation.name} — made on TIPSYGO`, description, type: "website", images: ["/tipsygo-logo-v2.png"] }, twitter: { card: "summary_large_image", title: `${creation.name} | TIPSYGO`, description, images: ["/tipsygo-logo-v2.png"] } };
}

export default async function SharedMixPage({ params }: Props) {
  const creation = publicCreation((await params).slug);
  if (!creation) notFound();
  return <main className="shared-mix-page"><header><Link href="/" aria-label="TipsyGo home"><Image src="/tipsygo-logo-v2.png" alt="TIPSYGO" width={2048} height={768} priority /></Link><span>Community creation</span></header><section><div className="shared-mix-art"><div>✦</div><span>Made on<br />TIPSYGO</span></div><article><p className="eyebrow">A cocktail worth sharing</p><h1>{creation.name}</h1><p className="shared-mix-recipe">{Object.values(creation.choices).join(" · ")}</p><div className="shared-mix-stats"><span><strong>{creation.orderCount}</strong> order{creation.orderCount === 1 ? "" : "s"}</span><span><strong>${(creation.unitCents / 100).toFixed(2)}</strong> current price</span></div><SharedMixActions creation={creation} /></article></section></main>;
}
