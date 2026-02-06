
import { Task, TaskRequirement } from '../types/task';
import taskData from '../../data/tarkov-tasks.json';
import hideoutData from '../../data/hideout.json';
import traderData from '../../data/traders.json';

// Type definitions for the raw JSON data (approximate)
interface RawHideoutStation {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string;
    levels: {
        level: number;
        constructionTime: number;
        description?: string;
        itemRequirements: {
            item: {
                id: string;
                name: string;
                shortName: string;
                iconLink?: string;
                wikiLink?: string;
                avg24hPrice?: number;
            };
            count: number;
            attributes?: {
                name: string;
                value: string;
            }[];
        }[];
        stationLevelRequirements: {
            station: {
                id: string;
                normalizedName: string;
                name: string;
            };
            level: number;
        }[];
        traderRequirements: {
            trader: {
                id: string;
                normalizedName: string;
                name: string;
            };
            level: number;
        }[];
        skillRequirements: {
            skill: {
                name: string;
            };
            level: number;
        }[];
    }[];
}

interface RawTrader {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string;
    levels: {
        level: number;
        requiredPlayerLevel: number;
        requiredReputation: number;
        requiredCommerce: number;
    }[];
}

export function loadAllTasks(): Task[] {
    const tasks: Task[] = [...(taskData as any).tasks.map((t: any) => ({ ...t, type: 'task' }))];

    // Process Traders
    (traderData as RawTrader[]).forEach(trader => {
        trader.levels.forEach(levelData => {
            if (levelData.level === 1) return; // Level 1 is start, no requirements usually (or implicitly default)

            const taskId = `trader-${trader.normalizedName}-${levelData.level}`;
            const prevLevelId = `trader-${trader.normalizedName}-${levelData.level - 1}`;

            const reqs: TaskRequirement[] = [];

            // Dependency on previous level? Valid logic, but usually LL2 just requires Level/Rep/Commerce.
            // But showing it as a progression chain is nice.
            if (levelData.level > 1) {
                // We don't strictly enforce LL1 completion as a "task" because everyone starts at LL1.
                // But purely for visual tree, we can link them.
                // For now, let's NOT link to previous level to avoid clutter, unless we treat LL1 as a root node.
            }

            const traderTask: Task = {
                id: taskId,
                name: `${trader.name} LL${levelData.level}`,
                type: 'trader',
                trader: { name: trader.name },
                minPlayerLevel: levelData.requiredPlayerLevel,
                experience: 0,
                objectives: [],
                taskRequirements: [],
                traderId: trader.id,
                traderLevel: levelData.level,
                requiredReputation: levelData.requiredReputation,
                requiredCommerce: levelData.requiredCommerce,
            };

            tasks.push(traderTask);
        });
    });

    // Process Hideout
    (hideoutData as RawHideoutStation[]).forEach(station => {
        station.levels.forEach(levelData => {
            const taskId = `hideout-${station.normalizedName}-${levelData.level}`;

            const reqs: TaskRequirement[] = [];

            // Station Level Requirements
            levelData.stationLevelRequirements.forEach(req => {
                const reqId = `hideout-${req.station.normalizedName}-${req.level}`;
                reqs.push({
                    task: { id: reqId, name: `${req.station.name} Level ${req.level}` },
                    status: 'complete'
                });
            });

            // Trader Requirements
            levelData.traderRequirements.forEach(req => {
                const reqId = `trader-${req.trader.normalizedName}-${req.level}`;
                reqs.push({
                    task: { id: reqId, name: `${req.trader.name} LL${req.level}` },
                    status: 'complete'
                });
            });

            // Requirements for previous level of same station?
            // implicitly, Level 2 requires Level 1. The API might not return this explicitly, or it might.
            // Usually it's implicit. Let's add it if not present.
            if (levelData.level > 1) {
                const prevLevelId = `hideout-${station.normalizedName}-${levelData.level - 1}`;
                // Check if already in requirements (unlikely via API but possible)
                if (!reqs.find(r => r.task.id === prevLevelId)) {
                    reqs.push({
                        task: { id: prevLevelId, name: `${station.name} Level ${levelData.level - 1}` },
                        status: 'complete'
                    });
                }
            }

            const hideoutTask: Task = {
                id: taskId,
                name: `${station.name} Level ${levelData.level}`,
                type: 'hideout',
                // Group under the station name? Or create a "Hideout" trader?
                // Let's us a pseudo-trader "Hideout" for grouping in the UI if needed,
                // or just keep original trader if we assign one. 
                // For now, let's assign a "Hideout" trader so they appear together.
                trader: { name: 'Hideout' },
                minPlayerLevel: 0, // Usually gated by traders/skills, not directly level (except via trader)
                experience: 0,
                objectives: [], // We could put item requirements here as objectives
                taskRequirements: reqs,
                hideoutStationId: station.id,
                hideoutLevel: levelData.level,
                constructionTime: levelData.constructionTime,
            };

            // Convert item requirements to firItems format? 
            // The current app uses separate `firItemsData` loaded from `tarkov-fir-items.json`.
            // We might want to pass these item requirements to the `TaskNode` somehow.
            // For now, let's access them via the `itemRequirements` property on the raw data
            // IF we stored it on the task. But Task interface doesn't have it.
            // We can add it or repurpose objectives.

            // Let's map item requirements to simple objectives for display
            levelData.itemRequirements.forEach(itemReq => {
                hideoutTask.objectives.push({
                    id: `${taskId}-item-${itemReq.item.id}`,
                    type: 'giveItem',
                    description: `Hand over ${itemReq.item.name}`,
                    // We'll need extended objective fields if we want to show counts properly in standard UI
                });
            });

            // Also support skills?
            levelData.skillRequirements.forEach(skillReq => {
                hideoutTask.objectives.push({
                    id: `${taskId}-skill-${skillReq.skill.name}`,
                    type: 'skill',
                    description: `Level ${skillReq.level} ${skillReq.skill.name}`
                });
            });

            tasks.push(hideoutTask);
        });
    });

    return tasks;
}

import { TaskWithFirItems, TaskFirItem, FirItemDetail } from '../types/firItem';

export function getHideoutItems(): { items: TaskWithFirItems[], details: FirItemDetail[] } {
    const items: TaskWithFirItems[] = [];
    const detailsMap = new Map<string, FirItemDetail>();

    // First pass: build a map of all hideout task dependencies (including non-FiR tasks)
    const taskDependencyMap = new Map<string, number>();

    (hideoutData as RawHideoutStation[]).forEach(station => {
        station.levels.forEach(levelData => {
            const taskId = `hideout-${station.normalizedName}-${levelData.level}`;
            const dependencyCount = levelData.stationLevelRequirements?.length || 0;
            taskDependencyMap.set(taskId, dependencyCount);
        });
    });

    // Second pass: process only tasks with FiR items
    (hideoutData as RawHideoutStation[]).forEach(station => {
        station.levels.forEach(levelData => {
            if (!levelData.itemRequirements || levelData.itemRequirements.length === 0) return;

            const taskId = `hideout-${station.normalizedName}-${levelData.level}`;

            const firItems: TaskFirItem[] = levelData.itemRequirements.map(req => {
                const isFir = req.attributes?.some(a => a.name === 'foundInRaid' && a.value === 'true');

                // Collect details for all items (not just FiR)
                if (!detailsMap.has(req.item.id)) {
                    detailsMap.set(req.item.id, {
                        id: req.item.id,
                        name: req.item.name,
                        shortName: req.item.shortName,
                        iconLink: req.item.iconLink || '',
                        wikiLink: req.item.wikiLink || '',
                        avg24hPrice: req.item.avg24hPrice || 0,
                        weight: 0,
                        width: 0,
                        height: 0,
                        requiredByTasks: []
                    });
                }

                return {
                    itemId: req.item.id,
                    itemName: req.item.name,
                    itemShortName: req.item.shortName,
                    count: req.count,
                    optional: false,
                    isFirRequired: isFir,
                    objectiveDescription: `Hand over ${req.item.name}`
                };
            });

            if (firItems.length === 0) return;

            // Map station requirements to task requirements
            const taskRequirements = (levelData.stationLevelRequirements || []).map(req => ({
                taskId: `hideout-${req.station.normalizedName}-${req.level}`,
                taskName: `${req.station.name} Level ${req.level}`,
                status: []
            }));

            items.push({
                taskId: taskId,
                taskName: `${station.name} Level ${levelData.level}`,
                trader: 'Hideout',
                minPlayerLevel: 0,
                experience: 0,
                firItems: firItems,
                taskRequirements: taskRequirements,
                dependencyCount: taskDependencyMap.get(taskId) || 0
            });
        });
    });

    return { items, details: Array.from(detailsMap.values()) };
}
