import GameWorkspace from '@/app/components/modern/GameWorkspace';
import { traderRoutes } from '@/src/server/routes';
import { slugToTraderName } from '@/app/lib/traderSlug';
export const generateStaticParams = traderRoutes;
export default async function TraderPage({ params }: { params: Promise<{ trader: string }> }) {
  const { trader } = await params;
  const name = slugToTraderName(trader);
  return (
    <GameWorkspace
      trader={name === 'Hideout' ? undefined : name}
      section={name === 'Hideout' ? 'hideout' : 'tasks'}
    />
  );
}
