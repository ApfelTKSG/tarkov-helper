export function makeFeeds() {
  const resources = {
    tasks: {
      tasks: {
        taskA: {
          id: 'taskA',
          name: 'taskA name',
          trader: 'traderA',
          minPlayerLevel: 1,
          taskRequirements: [],
          traderRequirements: [],
          objectives: [
            {
              id: 'objectiveA',
              type: 'giveItem',
              description: 'objectiveA description',
              items: ['itemA', 'itemB'],
              count: 3,
              foundInRaid: true,
            },
          ],
          otherRequirements: [],
        },
        taskB: {
          id: 'taskB',
          name: 'taskB name',
          trader: 'traderA',
          taskRequirements: [{ task: 'taskA', status: ['complete', 'failed'] }],
          traderRequirements: [
            {
              id: 'gate',
              trader: 'traderA',
              requirementType: 'level',
              compareMethod: '>=',
              value: 2,
            },
          ],
          objectives: [],
          otherRequirements: [
            {
              id: 'global',
              type: 'globalVariable',
              variableId: 'opaque',
              compareMethod: '>=',
              value: 5,
            },
          ],
        },
      },
      questItems: {},
    },
    traders: {
      traderA: {
        id: 'traderA',
        name: 'traderA name',
        normalizedName: 'trader',
        resetTime: 'volatile',
        levels: [{ level: 1, requiredPlayerLevel: 0, requiredReputation: 0, requiredCommerce: 0 }],
      },
    },
    hideout: {
      stationA: {
        id: 'stationA',
        name: 'stationA name',
        levels: [{ level: 1, itemRequirements: [{ item: 'itemA', count: 2 }] }],
      },
    },
    maps: { maps: { mapA: { id: 'mapA', name: 'mapA name' } } },
    items: {
      items: {
        itemA: { id: 'itemA', name: 'itemA name', avg24hPrice: 50 },
        itemB: { id: 'itemB', name: 'itemB name', avg24hPrice: 60 },
        unused: { id: 'unused', name: 'Unused' },
      },
    },
  };
  const translations = {
    tasks: ['$.data.tasks.*.name', '$.data.tasks.*.objectives.*.description'],
    traders: ['$.data.*.name'],
    hideout: ['$.data.*.name'],
    maps: ['$.data.maps.*.name'],
    items: ['$.data.items.*.name'],
  };
  const en = {
    'taskA name': 'First',
    'taskB name': 'Second',
    'objectiveA description': 'Give three alternatives',
    'traderA name': 'Trader',
    'stationA name': 'Station',
    'mapA name': 'Map',
    'itemA name': 'Item A',
    'itemB name': 'Item B',
  };
  const ja = {
    'taskA name': '最初',
    'traderA name': 'トレーダー',
    'mapA name': 'マップ',
    'itemA name': '品A',
  };
  const feeds = {};
  for (const [key, data] of Object.entries(resources)) {
    feeds[key] = {
      body: { data, translations: translations[key] },
      path: `regular/${key}`,
      etag: 'v1',
      fetchedAt: '2026-10-06T00:00:00Z',
      lastModified: null,
    };
    for (const [lang, data] of [
      ['en', en],
      ['ja', ja],
    ])
      feeds[`${key}_${lang}`] = {
        body: { data },
        path: `regular/${key}_${lang}`,
        etag: 'v1',
        fetchedAt: '2026-10-06T00:00:00Z',
        lastModified: null,
      };
  }
  return feeds;
}
