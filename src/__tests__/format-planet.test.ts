/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, jest } from '@jest/globals';
import type {
  RawWarStatus,
  RawWarInfo,
  RawWarSummary,
  RawPlanetEvent,
} from '../api-types.js';
import type { WarSnapshot } from '../format-planet.js';

const mockLookupPlanetName = jest.fn((index: number) => (index === 0 ? 'Super Earth' : `Planet_${index}`));
const mockLookupSector = jest.fn((index: number) => (index === 0 ? 'Sol' : 'Unknown'));
const mockLookupBiome = jest.fn((_index: number) => ({ name: 'Terran', description: 'Earth-like' }));
const mockLookupHazards = jest.fn((_index: number) => [{ name: 'Cold', description: 'Very cold' }]);
const mockLookupFaction = jest.fn((id: number) => (id === 1 ? 'Humans' : id === 2 ? 'Terminids' : 'Unknown'));
const mockLookupRegion = jest.fn((_hash: number) => ({ name: 'Alpha Region', description: 'A region' }));
const mockToRelativeTime = jest.fn((_date: Date) => '5 hours ago');

jest.unstable_mockModule('../reference-data.js', () => ({
  lookupPlanetName: mockLookupPlanetName,
  lookupSector: mockLookupSector,
  lookupBiome: mockLookupBiome,
  lookupHazards: mockLookupHazards,
  lookupFaction: mockLookupFaction,
  lookupRegion: mockLookupRegion,
}));

jest.unstable_mockModule('../utils.js', () => ({
  WAR_START_TIMESTAMP: 1707929520,
  toRelativeTime: mockToRelativeTime,
  textResponse: (text: string) => ({ content: [{ type: 'text', text }] }),
  errorResponse: (text: string) => ({ content: [{ type: 'text', text }], isError: true }),
}));

// Dynamic import after mocks are registered
const {
  findPlanetInfo,
  findPlanetStatus,
  findPlanetEvent,
  findPlanetAttackTargets,
  formatPlanetDetails,
  formatActivePlanetSummary,
  loadWarSnapshot,
} = await import('../format-planet.js');

function makeSnapshot(overrides?: {
  planetStatus?: RawWarStatus['planetStatus'];
  planetEvents?: RawPlanetEvent[];
  planetAttacks?: RawWarStatus['planetAttacks'];
  planetRegions?: RawWarStatus['planetRegions'];
  planetInfos?: RawWarInfo['planetInfos'];
  planetRegionInfos?: RawWarInfo['planetRegions'];
}): WarSnapshot {
  const status: RawWarStatus = {
    warId: 801,
    time: 1000,
    impactMultiplier: 0.05,
    storyBeatId32: 0,
    planetStatus: overrides?.planetStatus ?? [
      { index: 0, owner: 1, health: 800_000, regenPerSecond: 1000, players: 50_000 },
    ],
    planetAttacks: overrides?.planetAttacks ?? [],
    campaigns: [],
    jointOperations: [],
    planetEvents: overrides?.planetEvents ?? [],
    planetRegions: overrides?.planetRegions ?? [],
  };

  const warInfo: RawWarInfo = {
    warId: 801,
    startDate: 1707929520,
    endDate: 9999999999,
    planetInfos: overrides?.planetInfos ?? [
      {
        index: 0,
        settingsHash: 12345,
        position: { x: 0.0, y: 0.0 },
        waypoints: [1, 2],
        sector: 0,
        maxHealth: 1_000_000,
        disabled: false,
        initialOwner: 1,
      },
    ],
    homeWorlds: [],
    planetRegions: overrides?.planetRegionInfos ?? [],
  };

  const rawSummary: RawWarSummary = {
    galaxy_stats: {
      missionsWon: 100, missionsLost: 20, missionTime: 5000,
      bugKills: 1000, automatonKills: 500, illuminateKills: 200,
      bulletsFired: 100_000, bulletsHit: 60_000, timePlayed: 999999,
      deaths: 3000, revives: 500, friendlies: 100,
      missionSuccessRate: 83, accurracy: 60,
    },
    planets_stats: [
      {
        planetIndex: 0,
        missionsWon: 50, missionsLost: 10, missionTime: 2500,
        bugKills: 500, automatonKills: 250, illuminateKills: 100,
        bulletsFired: 50_000, bulletsHit: 30_000, timePlayed: 500000,
        deaths: 1500, revives: 250, friendlies: 50,
        missionSuccessRate: 83, accurracy: 60,
      },
    ],
  };

  return {
    status,
    warInfo,
    summary: {
      galaxy_stats: rawSummary.galaxy_stats,
      planets_stats: rawSummary.planets_stats ?? [],
    },
  };
}

describe('findPlanetInfo', () => {
  it('returns planet info for known index', () => {
    const snap = makeSnapshot();
    const info = findPlanetInfo(snap, 0);
    expect(info).toBeDefined();
    expect(info!.index).toBe(0);
  });

  it('returns undefined for unknown index', () => {
    const snap = makeSnapshot();
    expect(findPlanetInfo(snap, 999)).toBeUndefined();
  });
});

describe('findPlanetStatus', () => {
  it('returns status for known index', () => {
    const snap = makeSnapshot();
    const status = findPlanetStatus(snap, 0);
    expect(status?.players).toBe(50_000);
  });
});

describe('findPlanetEvent', () => {
  it('returns event for known planet index', () => {
    const snap = makeSnapshot({
      planetEvents: [
        {
          id: 1, planetIndex: 0, eventType: 1, race: 2,
          health: 500_000, maxHealth: 1_000_000, startTime: 100,
          expireTime: 5000, campaignId: 1, jointOperationIds: [],
        },
      ],
    });
    const event = findPlanetEvent(snap, 0);
    expect(event?.race).toBe(2);
  });

  it('returns undefined when no event for planet', () => {
    const snap = makeSnapshot();
    expect(findPlanetEvent(snap, 0)).toBeUndefined();
  });
});

describe('findPlanetAttackTargets', () => {
  it('returns target indices for attacking planet', () => {
    const snap = makeSnapshot({
      planetAttacks: [{ source: 0, target: 5 }, { source: 0, target: 6 }],
    });
    expect(findPlanetAttackTargets(snap, 0)).toEqual([5, 6]);
  });

  it('returns empty array when not attacking', () => {
    const snap = makeSnapshot();
    expect(findPlanetAttackTargets(snap, 0)).toEqual([]);
  });
});

describe('formatPlanetDetails', () => {
  it('includes planet name, sector, and owner', () => {
    const snap = makeSnapshot();
    const output = formatPlanetDetails(snap, 0);
    expect(output).toContain('Name: Super Earth');
    expect(output).toContain('Sector: Sol');
    expect(output).toContain('Current Owner: Humans');
  });

  it('includes health and max health', () => {
    const snap = makeSnapshot();
    const output = formatPlanetDetails(snap, 0);
    expect(output).toContain('Health: 800000');
    expect(output).toContain('Max Health: 1000000');
  });

  it('shows "None" for event when no event exists', () => {
    const snap = makeSnapshot();
    const output = formatPlanetDetails(snap, 0);
    expect(output).toContain('Event:\nNone');
  });

  it('shows event details when event exists', () => {
    const snap = makeSnapshot({
      planetEvents: [
        {
          id: 1, planetIndex: 0, eventType: 1, race: 2,
          health: 500_000, maxHealth: 1_000_000, startTime: 100,
          expireTime: 5000, campaignId: 1, jointOperationIds: [],
        },
      ],
    });
    const output = formatPlanetDetails(snap, 0);
    expect(output).toContain('Faction: Terminids');
  });

  it('shows waypoints', () => {
    const snap = makeSnapshot();
    const output = formatPlanetDetails(snap, 0);
    expect(output).toContain('Waypoints: 1, 2');
  });
});

describe('formatActivePlanetSummary', () => {
  it('includes planet name, sector, and player count', () => {
    const snap = makeSnapshot();
    const output = formatActivePlanetSummary(snap, 0);
    expect(output).toContain('Name: Super Earth');
    expect(output).toContain('Sector: Sol');
    expect(output).toContain('Player Count: 50000');
  });

  it('shows "None" for event when no event', () => {
    const snap = makeSnapshot();
    const output = formatActivePlanetSummary(snap, 0);
    expect(output).toContain('Event:\nNone');
  });
});

describe('loadWarSnapshot', () => {
  it('calls all three endpoints and assembles snapshot', async () => {
    const snap = makeSnapshot();

    const fetcher = jest.fn<(path: string) => Promise<unknown>>().mockImplementation((path: string) => {
      if (path.includes('Status')) return Promise.resolve(snap.status);
      if (path.includes('WarInfo')) return Promise.resolve(snap.warInfo);
      if (path.includes('summary')) {
        return Promise.resolve({ galaxy_stats: snap.summary.galaxy_stats, planets_stats: snap.summary.planets_stats });
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const result = await loadWarSnapshot(fetcher as <T>(path: string) => Promise<T>);
    expect(result.status.warId).toBe(801);
    expect(result.warInfo.planetInfos).toHaveLength(1);
    expect(result.summary.galaxy_stats.missionsWon).toBe(100);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
