import type { TaskDefinition } from './progression';

export type GameMode = 'regular' | 'pve' | 'pvp-season';
export interface GameItem {
  id: string;
  name: string;
  englishName?: string;
  shortName?: string;
  iconLink?: string;
  wikiLink?: string;
}
export interface Objective {
  id: string;
  type: string;
  description: string;
  count?: number | null;
  optional?: boolean;
  foundInRaid?: boolean;
  item?: string;
  items?: string[];
  maps?: string[];
  markerItem?: string;
  requiredKeys?: string[][];
  weapons?: string[];
  wearing?: string[][];
}
export interface GameTask extends TaskDefinition {
  supplementLoyaltyLevel?: number;
  finishRewards?: { traderStanding: { trader: string; standing: number }[] };
  failureOutcome?: { traderStanding: { trader: string; standing: number }[] };
  name: string;
  englishName: string;
  trader: string;
  objectives: Objective[];
  experience?: number;
  wikiLink?: string;
  kappaRequired?: boolean;
  lightkeeperRequired?: boolean;
  map?: string;
  neededKeys?: { map: string; keys: string[] }[];
}
export interface GameTrader {
  id: string;
  name: string;
  englishName: string;
  levels: { level: number; requiredPlayerLevel: number; requiredReputation: number }[];
}
export interface StationLevel {
  id: string;
  level: number;
  constructionTime?: number;
  description?: string;
  itemRequirements: {
    id: string;
    item: string;
    count: number;
    attributes?: { foundInRaid?: boolean };
  }[];
  stationLevelRequirements: { id: string; station: string; level: number }[];
  traderRequirements: TaskDefinition['traderRequirements'];
  skillRequirements: { id: string; skill: string; level: number }[];
}
export interface GameSnapshot {
  progressionRuleRevision?: string;
  progressionCounters?: Record<string, import('./progression').ProgressionCounter>;
  schemaVersion: number;
  mode: GameMode;
  seasonId: string | null;
  revision: string;
  generatedAt: string;
  tasks: GameTask[];
  traders: GameTrader[];
  items: Record<string, GameItem>;
  stations: { id: string; name: string; normalizedName: string; levels: StationLevel[] }[];
  maps: { id: string; name: string; englishName: string }[];
  prestige: { id: string; prestigeLevel: number }[];
}
export interface ManifestEntry {
  revision: string;
  file: string;
  taskCount: number;
  generatedAt: string;
  seasonId: string | null;
  previous: { revision: string; file: string } | null;
  diff: {
    initial: boolean;
    added: string[];
    removed: string[];
    changed: string[];
    otherDataChanged: boolean;
  };
}
export interface GameManifest {
  schemaVersion: number;
  updatedAt: string;
  modes: Record<GameMode, ManifestEntry>;
}
