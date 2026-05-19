import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { WarSnapshot } from '../format-planet.js';

const mockHd2Fetch = jest.fn<(path: string) => Promise<unknown>>();
const mockLoadWarSnapshot = jest.fn<() => Promise<WarSnapshot>>();
const mockFormatPlanetDetails = jest.fn((_snap: unknown, idx: number) =>
  `Name: ${idx === 0 ? 'Super Earth' : 'Planet_' + idx}\nSector: Sol\nCurrent Owner: Humans`,
);
const mockLookupEffect = jest.fn((id: number) =>
  id === 10 ? { name: 'Ion Storm', description: 'Disrupts electronics', galacticEffectId: 10 } : null,
);
const mockLookupItem = jest.fn((id: number | string) =>
  String(id) === '99' ? { name: 'Requisition Slips', mix_id: 'req_99' } : null,
);

jest.unstable_mockModule('../client.js', () => ({
  hd2Fetch: mockHd2Fetch,
}));

jest.unstable_mockModule('../reference-data.js', () => ({
  lookupPlanetName: jest.fn((idx: number) => (idx === 0 ? 'Super Earth' : `Planet_${idx}`)),
  lookupSector: jest.fn(() => 'Sol'),
  lookupBiome: jest.fn(() => null),
  lookupHazards: jest.fn(() => []),
  lookupFaction: jest.fn((id: number) => (id === 1 ? 'Humans' : 'Unknown')),
  lookupRegion: jest.fn(() => null),
  lookupEffect: mockLookupEffect,
  lookupItem: mockLookupItem,
}));

jest.unstable_mockModule('../format-planet.js', () => ({
  loadWarSnapshot: mockLoadWarSnapshot,
  formatPlanetDetails: mockFormatPlanetDetails,
}));

const { getSpaceStationDetails } = await import('../tools/dss.js');

const minimalSnap: WarSnapshot = {
  status: {
    warId: 801, time: 1000, impactMultiplier: 0.05, storyBeatId32: 0,
    planetStatus: [{ index: 0, owner: 1, health: 1_000_000, regenPerSecond: 100, players: 10000 }],
    planetAttacks: [], campaigns: [], jointOperations: [], planetEvents: [], planetRegions: [],
  },
  warInfo: {
    warId: 801, startDate: 1707929520, endDate: 9999999999,
    planetInfos: [{ index: 0, settingsHash: 1, position: { x: 0, y: 0 }, waypoints: [], sector: 0, maxHealth: 1_000_000, disabled: false, initialOwner: 1 }],
    homeWorlds: [], planetRegions: [],
  },
  summary: {
    galaxy_stats: {
      missionsWon: 0, missionsLost: 0, missionTime: 0, bugKills: 0, automatonKills: 0,
      illuminateKills: 0, bulletsFired: 0, bulletsHit: 0, timePlayed: 0,
      deaths: 0, revives: 0, friendlies: 0, missionSuccessRate: 0, accurracy: 0,
    },
    planets_stats: [],
  },
};

function makeStation(overrides: { tacticalActions?: unknown[]; planetIndex?: number | null } = {}) {
  const planetIndex = overrides.planetIndex !== undefined ? overrides.planetIndex : 0;
  return {
    id32: 1,
    planet: planetIndex !== null ? { index: planetIndex } : undefined,
    electionEnd: '2025-12-31T00:00:00Z',
    flags: 0,
    tacticalActions: overrides.tacticalActions ?? [
      {
        id32: 100,
        mediaId32: 0,
        name: 'Orbital Bombardment',
        description: 'Bombard a planet',
        strategicDescription: '<span data-ah="1">Strategic Hint</span>',
        status: 2,
        statusExpire: '2025-12-31T06:00:00Z',
        costs: [
          {
            id: 'c1',
            itemMixId: 99,
            targetValue: 1000,
            currentValue: 500,
            deltaPerSecond: 1.5,
            maxDonationAmmount: 100,
            maxDonationPeriodSeconds: 60,
          },
        ],
        effectIds: [10],
      },
    ],
  };
}

describe('getSpaceStationDetails.handler()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
    mockLoadWarSnapshot.mockResolvedValue(minimalSnap);
  });

  afterEach(() => {
    jest.useRealTimers();
    mockHd2Fetch.mockReset();
    mockLoadWarSnapshot.mockReset();
  });

  it('returns error when stations array is empty', async () => {
    mockHd2Fetch.mockResolvedValueOnce([]);
    const result = await getSpaceStationDetails.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No space stations found');
  });

  it('includes planet info in output', async () => {
    mockHd2Fetch.mockResolvedValueOnce([makeStation()]);
    const result = await getSpaceStationDetails.handler({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Super Earth');
  });

  it('renders tactical action name and status "Active" for status=2', async () => {
    mockHd2Fetch.mockResolvedValueOnce([makeStation()]);
    const result = await getSpaceStationDetails.handler({});
    const text = result.content[0].text;
    expect(text).toContain('Orbital Bombardment');
    expect(text).toContain('Status: Active');
  });

  it('decodes effect lookup in tactical action', async () => {
    mockHd2Fetch.mockResolvedValueOnce([makeStation()]);
    const result = await getSpaceStationDetails.handler({});
    expect(result.content[0].text).toContain('Ion Storm');
  });

  it('decodes item lookup in tactical action cost', async () => {
    mockHd2Fetch.mockResolvedValueOnce([makeStation()]);
    const result = await getSpaceStationDetails.handler({});
    expect(result.content[0].text).toContain('Requisition Slips');
  });

  it('strips span markup from strategic description', async () => {
    mockHd2Fetch.mockResolvedValueOnce([makeStation()]);
    const result = await getSpaceStationDetails.handler({});
    const text = result.content[0].text;
    expect(text).toContain('Strategic Hint');
    expect(text).not.toContain('<span');
  });

  it('returns error response on fetch failure', async () => {
    mockHd2Fetch.mockRejectedValueOnce(new Error('API error'));
    const result = await getSpaceStationDetails.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch space station details');
  });
});
