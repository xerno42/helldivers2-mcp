import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { WarSnapshot } from '../format-planet.js';

const mockGetReferenceData = jest.fn(() => ({
  planets: {
    '0': { name: 'Super Earth', sector: 'Sol' },
    '1': { name: 'Meridia', sector: 'Orion' },
  },
}));
const mockLookupPlanetName = jest.fn((idx: number) => (idx === 0 ? 'Super Earth' : `Planet_${idx}`));
const mockLookupSector = jest.fn((idx: number) => (idx === 0 ? 'Sol' : 'Unknown'));
const mockLookupBiome = jest.fn(() => ({ name: 'Terran', description: 'Earth-like' }));
const mockLookupHazards = jest.fn(() => []);
const mockLookupFaction = jest.fn((id: number) => (id === 1 ? 'Humans' : 'Unknown'));
const mockLookupRegion = jest.fn(() => null);

const mockLoadWarSnapshot = jest.fn<() => Promise<WarSnapshot>>();
const mockFormatPlanetDetails = jest.fn((_snap: unknown, index: number) =>
  `Name: ${index === 0 ? 'Super Earth' : 'Planet_' + index}\nSector: Sol\nCurrent Owner: Humans`,
);

jest.unstable_mockModule('../client.js', () => ({ hd2Fetch: jest.fn() }));

jest.unstable_mockModule('../reference-data.js', () => ({
  getReferenceData: mockGetReferenceData,
  lookupPlanetName: mockLookupPlanetName,
  lookupSector: mockLookupSector,
  lookupBiome: mockLookupBiome,
  lookupHazards: mockLookupHazards,
  lookupFaction: mockLookupFaction,
  lookupRegion: mockLookupRegion,
}));

jest.unstable_mockModule('../format-planet.js', () => ({
  loadWarSnapshot: mockLoadWarSnapshot,
  formatPlanetDetails: mockFormatPlanetDetails,
}));

const { getAllPlanets, getPlanetDetails } = await import('../tools/planets.js');

function makeMinimalSnap(planetIndex = 0): WarSnapshot {
  return {
    status: {
      warId: 801, time: 1000, impactMultiplier: 0.05, storyBeatId32: 0,
      planetStatus: [{ index: planetIndex, owner: 1, health: 800_000, regenPerSecond: 100, players: 5000 }],
      planetAttacks: [], campaigns: [], jointOperations: [], planetEvents: [], planetRegions: [],
    },
    warInfo: {
      warId: 801, startDate: 1707929520, endDate: 9999999999,
      planetInfos: [
        {
          index: planetIndex, settingsHash: 1, position: { x: 0, y: 0 }, waypoints: [],
          sector: 0, maxHealth: 1_000_000, disabled: false, initialOwner: 1,
        },
      ],
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
}

describe('getAllPlanets.handler()', () => {
  it('returns list of planets with id, name, sector', async () => {
    const result = await getAllPlanets.handler({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Super Earth');
    expect(result.content[0].text).toContain('Meridia');
  });
});

describe('getPlanetDetails.handler()', () => {
  beforeEach(() => {
    mockLoadWarSnapshot.mockResolvedValue(makeMinimalSnap(0));
  });

  it('rejects empty array with isError and "non-empty array" message', async () => {
    const result = await getPlanetDetails.handler({ planetindices: [] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('non-empty array');
  });

  it('rejects more than 5 indices with "Maximum allowed is 5" message', async () => {
    const result = await getPlanetDetails.handler({ planetindices: [0, 1, 2, 3, 4, 5] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Maximum allowed is 5');
  });

  it('rejects a float like 1.5 with "Must be an integer" message', async () => {
    const result = await getPlanetDetails.handler({ planetindices: [1.5] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Must be an integer');
  });

  it('rejects string "3abc" (non-integer string) with isError', async () => {
    const result = await getPlanetDetails.handler({ planetindices: ['3abc'] });
    expect(result.isError).toBe(true);
  });

  it('accepts numeric string "0" without error', async () => {
    const result = await getPlanetDetails.handler({ planetindices: ['0'] });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Super Earth');
  });

  it('rejects unknown index 999 with "Planet index 999 not found. Valid range:" message', async () => {
    const result = await getPlanetDetails.handler({ planetindices: [999] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Planet index 999 not found. Valid range:');
  });

  it('happy path returns formatted text containing planet name and owner', async () => {
    const result = await getPlanetDetails.handler({ planetindices: [0] });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Super Earth');
    expect(result.content[0].text).toContain('Humans');
  });

  it('returns error when loadWarSnapshot throws', async () => {
    mockLoadWarSnapshot.mockRejectedValueOnce(new Error('Network error'));
    const result = await getPlanetDetails.handler({ planetindices: [0] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch planet details');
  });
});
