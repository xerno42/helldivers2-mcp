import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Create mock function at module level so it can be referenced in the factory
const mockReadFileSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
  },
}));

const PLANETS_JSON = JSON.stringify({
  '0': { name: 'Super Earth', sector: 'Sol', biome: 'terran', environmentals: ['cold'] },
  '1': { name: 'Meridia', sector: 'Orion', biome: 'jungle', environmentals: ['hot', 'unknown_hazard'] },
});
const BIOMES_JSON = JSON.stringify({
  terran: { name: 'Terran', description: 'Earth-like' },
  jungle: { name: 'Jungle', description: 'Dense jungle' },
});
const ENVIRONMENTALS_JSON = JSON.stringify({
  cold: { name: 'Cold', description: 'Very cold' },
  hot: { name: 'Hot', description: 'Very hot' },
});
const PLANET_REGIONS_JSON = JSON.stringify({
  '12345': { name: 'Region Alpha', description: 'A region', region_faction: 'Humans', region_type: 'settlement' },
});
const FACTIONS_JSON = JSON.stringify({ '1': 'Humans', '2': 'Terminids' });
const PLANET_EFFECTS_JSON = JSON.stringify({
  '99': { name: 'Storm', description: 'Electrical storm', galacticEffectId: 99 },
});
const ITEM_NAMES_JSON = JSON.stringify({
  '42': { name: 'Requisition Slips', mix_id: 'req_42' },
});

function setupMockFs() {
  mockReadFileSync.mockImplementation((filePath: unknown) => {
    const p = String(filePath);
    if (p.endsWith('planets/planets.json')) return PLANETS_JSON;
    if (p.endsWith('planets/biomes.json')) return BIOMES_JSON;
    if (p.endsWith('planets/environmentals.json')) return ENVIRONMENTALS_JSON;
    if (p.endsWith('planets/planetRegion.json')) return PLANET_REGIONS_JSON;
    if (p.endsWith('factions.json')) return FACTIONS_JSON;
    if (p.endsWith('effects/planetEffects.json')) return PLANET_EFFECTS_JSON;
    if (p.endsWith('items/item_names.json')) return ITEM_NAMES_JSON;
    throw new Error(`File not found: ${p}`);
  });
}

describe('getReferenceData()', () => {
  beforeEach(() => {
    jest.resetModules();
    mockReadFileSync.mockReset();
    setupMockFs();
  });

  it('returns populated data from mocked fs', async () => {
    const { getReferenceData } = await import('../reference-data.js');
    const data = getReferenceData();
    expect(data.planets['0'].name).toBe('Super Earth');
    expect(data.factions['2']).toBe('Terminids');
  });

  it('memoizes: readFileSync called only once per data shape', async () => {
    const { getReferenceData } = await import('../reference-data.js');
    getReferenceData();
    getReferenceData();
    // 7 files total — called exactly 7 times (not 14)
    expect(mockReadFileSync).toHaveBeenCalledTimes(7);
  });

  it('gracefully degrades to {} when a file is missing and logs warning', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockReadFileSync.mockImplementation((filePath: unknown) => {
      const p = String(filePath);
      if (p.endsWith('factions.json')) throw new Error('ENOENT: no such file');
      if (p.endsWith('planets/planets.json')) return PLANETS_JSON;
      if (p.endsWith('planets/biomes.json')) return BIOMES_JSON;
      if (p.endsWith('planets/environmentals.json')) return ENVIRONMENTALS_JSON;
      if (p.endsWith('planets/planetRegion.json')) return PLANET_REGIONS_JSON;
      if (p.endsWith('effects/planetEffects.json')) return PLANET_EFFECTS_JSON;
      if (p.endsWith('items/item_names.json')) return ITEM_NAMES_JSON;
      throw new Error(`File not found: ${p}`);
    });
    const { getReferenceData } = await import('../reference-data.js');
    const data = getReferenceData();
    expect(data.factions).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[reference-data]'));
    warnSpy.mockRestore();
  });
});

describe('lookup helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    mockReadFileSync.mockReset();
    setupMockFs();
  });

  it('lookupPlanetName returns name for known index', async () => {
    const { lookupPlanetName } = await import('../reference-data.js');
    expect(lookupPlanetName(0)).toBe('Super Earth');
  });

  it('lookupPlanetName returns "Unknown" for unknown index', async () => {
    const { lookupPlanetName } = await import('../reference-data.js');
    expect(lookupPlanetName(999)).toBe('Unknown');
  });

  it('lookupSector returns sector for known index', async () => {
    const { lookupSector } = await import('../reference-data.js');
    expect(lookupSector(0)).toBe('Sol');
  });

  it('lookupBiome returns biome data for known index', async () => {
    const { lookupBiome } = await import('../reference-data.js');
    const biome = lookupBiome(0);
    expect(biome?.name).toBe('Terran');
  });

  it('lookupBiome returns null for planet without biome', async () => {
    const { lookupBiome } = await import('../reference-data.js');
    expect(lookupBiome(999)).toBeNull();
  });

  it('lookupHazards returns matching hazards (filters missing keys)', async () => {
    const { lookupHazards } = await import('../reference-data.js');
    // Planet 1 has ['hot', 'unknown_hazard'] — unknown_hazard not in environmentals JSON, filtered
    const hazards = lookupHazards(1);
    expect(hazards).toHaveLength(1);
    expect(hazards[0].name).toBe('Hot');
  });

  it('lookupHazards returns [] for unknown planet', async () => {
    const { lookupHazards } = await import('../reference-data.js');
    expect(lookupHazards(999)).toEqual([]);
  });

  it('lookupFaction returns faction name', async () => {
    const { lookupFaction } = await import('../reference-data.js');
    expect(lookupFaction(1)).toBe('Humans');
  });

  it('lookupFaction returns "Unknown" for unknown id', async () => {
    const { lookupFaction } = await import('../reference-data.js');
    expect(lookupFaction(99)).toBe('Unknown');
  });

  it('lookupRegion returns region ref by hash', async () => {
    const { lookupRegion } = await import('../reference-data.js');
    const region = lookupRegion(12345);
    expect(region?.name).toBe('Region Alpha');
  });

  it('lookupRegion returns null for unknown hash', async () => {
    const { lookupRegion } = await import('../reference-data.js');
    expect(lookupRegion(99999)).toBeNull();
  });

  it('lookupEffect returns effect by id', async () => {
    const { lookupEffect } = await import('../reference-data.js');
    const effect = lookupEffect(99);
    expect(effect?.name).toBe('Storm');
  });

  it('lookupItem returns item by id', async () => {
    const { lookupItem } = await import('../reference-data.js');
    const item = lookupItem(42);
    expect(item?.name).toBe('Requisition Slips');
  });

  it('lookupItem returns null for unknown id', async () => {
    const { lookupItem } = await import('../reference-data.js');
    expect(lookupItem(9999)).toBeNull();
  });
});
