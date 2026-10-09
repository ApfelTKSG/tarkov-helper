import GameWorkspace from '@/app/components/modern/GameWorkspace';
import { traderRoutes } from '@/src/server/routes';
import { slugToTraderName } from '@/app/lib/traderSlug';
import { notFound } from 'next/navigation';
export const generateStaticParams = traderRoutes;
export default async function TraderFirPage({ params }: { params: Promise<{ trader: string }> }) {
  const { trader } = await params;
  const name = slugToTraderName(trader);
  if (name === 'Hideout') notFound();
  return <GameWorkspace trader={name} section="items" />;
}
