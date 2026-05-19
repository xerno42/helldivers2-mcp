import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { WarSnapshot } from '../format-planet.js';

const mockLoadWarSnapshot = jest.fn<() => Promise<WarSnapshot>>();
const mockFormatActivePlanetSummary = jest.fn((_snap: unknown, idx: number) =>
  `Name: ${idx === 0 ? 'Super Earth' : 'Planet_' + idx}\nSector: Sol\nPlayer Count: ${idx === 0 ? 5000 : 3000}\nEvent:\nNone\nAttacking: None\nActive Regions:\nNone`,
);

jest.unstable_mockModule('../client.js', () => ({ hd2Fetch: jest.fn() }));

jest.unstable_mockModule('../format-planet.js', () => ({
  loadWarSnapshot: mockLoadWarSnapshot,
  formatActivePlanetSummary: mockFormatActivePlanetSummary,
}));

const { getWarStatus } = await import('../tools/war.js');

const galaxyStats = {
  missionsWon: 1000, missionsLost: 200, missionTime: 50000,
  bugKills: 100000, automatonKills: 50000, illuminateKills: 20000,
  bulletsFired: 1000000, bulletsHit: 600000, timePlayed: 9999999,
  deaths: 30000, revives: 5000, friendlies: 1000,
  missionSuccessRate: 83, accurracy: 60,
};

type PlanetStatus = { index: number; owner: number; health: number; regenPerSecond: number; players: number };
type PlanetEvent = { id: number; planetIndex: number; eventType: number; race: number; health: number; maxHealth: number; startTime: number; expireTime: number; campaignId: number; jointOperationIds: number[] };

function makeSnap(opts?: {
  planetStatus?: PlanetStatus[];
  planetEvents?: PlanetEvent[];
  planetMaxHealth?: number;
}): WarSnapshot {
  const ps = opts?.planetStatus ?? [
    { index: 0, owner: 1, health: 800_000, regenPerSecond: 100, players: 5000 },
  ];
  const planetInfos = ps.map((p) => ({
    index: p.index,
    settingsHash: 1,
    position: { x: 0, y: 0 },
    waypoints: [],
    sector: 0,
    maxHealth: opts?.planetMaxHealth ?? 1_000_000,
    disabled: false,
    initialOwner: 1,
  }));

  return {
    status: {
      warId: 801, time: 1000, impactMultiplier: 0.05, storyBeatId32: 0,
      planetStatus: ps,
      planetAttacks: [], campaigns: [], jointOperations: [],
      planetEvents: opts?.planetEvents ?? [],
      planetRegions: [],
    },
    warInfo: {
      warId: 801, startDate: 1707929520, endDate: 9999999999,
      planetInfos, homeWorlds: [], planetRegions: [],
    },
    summary: { galaxy_stats: galaxyStats, planets_stats: [] },
  };
}

describe('getWarStatus.handler()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    mockLoadWarSnapshot.mockReset();
  });

  it('returns war statistics with Player Count summed from planetStatus', async () => {
    mockLoadWarSnapshot.mockResolvedValueOnce(makeSnap({
      planetStatus: [
        { index: 0, owner: 1, health: 800_000, regenPerSecond: 100, players: 5000 },
        { index: 1, owner: 1, health: 1_000_000, regenPerSecond: 100, players: 3000 },
      ],
    }));

    const result = await getWarStatus.handler({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Player Count: 8000');
  });

  it('includes active planet with players > 0 in output', async () => {
    mockLoadWarSnapshot.mockResolvedValueOnce(makeSnap({
      planetStatus: [{ index: 0, owner: 1, health: 800_000, regenPerSecond: 100, players: 5000 }],
    }));

    const result = await getWarStatus.handler({});
    const text = result.content[0].text;
    expect(text).toContain('Super Earth');
    expect(text).toContain('Active Planets:');
  });

  it('includes planet with health < maxHealth even with 0 players', async () => {
    mockLoadWarSnapshot.mockResolvedValueOnce(makeSnap({
      planetStatus: [{ index: 0, owner: 1, health: 500_000, regenPerSecond: 100, players: 0 }],
      planetMaxHealth: 1_000_000,
    }));

    const result = await getWarStatus.handler({});
    expect(result.content[0].text).toContain('Super Earth');
  });

  it('includes planet with active planetEvent even at full health and 0 players', async () => {
    mockLoadWarSnapshot.mockResolvedValueOnce(makeSnap({
      planetStatus: [{ index: 0, owner: 1, health: 1_000_000, regenPerSecond: 100, players: 0 }],
      planetMaxHealth: 1_000_000,
      planetEvents: [
        { id: 1, planetIndex: 0, eventType: 1, race: 2, health: 500_000, maxHealth: 1_000_000, startTime: 100, expireTime: 5000, campaignId: 1, jointOperationIds: [] },
      ],
    }));

    const result = await getWarStatus.handler({});
    expect(result.content[0].text).toContain('Super Earth');
  });

  it('shows "No active planets." when no planet qualifies', async () => {
    mockLoadWarSnapshot.mockResolvedValueOnce(makeSnap({
      planetStatus: [{ index: 0, owner: 1, health: 1_000_000, regenPerSecond: 100, players: 0 }],
      planetMaxHealth: 1_000_000,
      planetEvents: [],
    }));

    const result = await getWarStatus.handler({});
    expect(result.content[0].text).toContain('No active planets.');
  });

  it('returns error response on fetch failure', async () => {
    mockLoadWarSnapshot.mockRejectedValueOnce(new Error('Network error'));
    const result = await getWarStatus.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch war status');
  });
});
