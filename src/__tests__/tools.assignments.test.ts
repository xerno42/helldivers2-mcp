import { describe, it, expect, jest, afterEach } from '@jest/globals';

const mockHd2Fetch = jest.fn<(path: string) => Promise<unknown>>();
const mockLookupPlanetName = jest.fn((idx: number) => (idx === 42 ? 'Turing' : `Planet_${idx}`));

jest.unstable_mockModule('../client.js', () => ({
  hd2Fetch: mockHd2Fetch,
}));

jest.unstable_mockModule('../reference-data.js', () => ({
  lookupPlanetName: mockLookupPlanetName,
}));

const { getAssignments } = await import('../tools/assignments.js');

function makeAssignment(overrides?: Partial<ReturnType<typeof defaultAssignment>>) {
  return { ...defaultAssignment(), ...overrides };
}

function defaultAssignment() {
  return {
    id32: 1,
    progress: [50, 100],
    expiresIn: 86400,
    setting: {
      type: 2,
      overrideTitle: 'Eradicate the Swarm',
      overrideBrief: 'Kill bugs',
      taskDescription: 'Eradicate Terminid presence',
      tasks: [] as { type: number; values: number[]; valueTypes: number[] }[],
      reward: { type: 1, id32: 0, amount: 45 },
      rewards: [],
      flags: 0,
    },
  };
}

describe('getAssignments.handler()', () => {
  afterEach(() => {
    mockHd2Fetch.mockReset();
  });

  it('returns "No active assignments." for empty array', async () => {
    mockHd2Fetch.mockResolvedValueOnce([]);
    const result = await getAssignments.handler({});
    expect(result.content[0].text).toBe('No active assignments.');
    expect(result.isError).toBeUndefined();
  });

  it('includes title, briefing, and reward in output', async () => {
    mockHd2Fetch.mockResolvedValueOnce([makeAssignment()]);
    const result = await getAssignments.handler({});
    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toContain('Eradicate the Swarm');
    expect(text).toContain('Kill bugs');
    expect(text).toContain('Medals - Amount: 45');
  });

  it('decodes race task value: vt=1, value=2 → Terminids', async () => {
    const assignment = makeAssignment({
      setting: {
        type: 3,
        overrideTitle: 'Eradicate',
        overrideBrief: 'Brief',
        taskDescription: 'Desc',
        tasks: [{ type: 3, values: [2], valueTypes: [1] }],
        reward: { type: 1, id32: 0, amount: 45 },
        rewards: [],
        flags: 0,
      },
    });
    mockHd2Fetch.mockResolvedValueOnce([assignment]);
    const result = await getAssignments.handler({});
    expect(result.content[0].text).toContain('Terminids');
  });

  it('decodes difficulty task value: vt=9, value=9 → "9 - Helldive"', async () => {
    const assignment = makeAssignment({
      setting: {
        type: 9,
        overrideTitle: 'Hard Order',
        overrideBrief: 'Brief',
        taskDescription: 'Desc',
        tasks: [{ type: 9, values: [9], valueTypes: [9] }],
        reward: { type: 1, id32: 0, amount: 45 },
        rewards: [],
        flags: 0,
      },
    });
    mockHd2Fetch.mockResolvedValueOnce([assignment]);
    const result = await getAssignments.handler({});
    expect(result.content[0].text).toContain('9 - Helldive');
  });

  it('enriches planet name when vt=11 (location_type=1) precedes vt=12 (location_index=42)', async () => {
    const assignment = makeAssignment({
      setting: {
        type: 11,
        overrideTitle: 'Liberation Order',
        overrideBrief: 'Brief',
        taskDescription: 'Desc',
        // vt=11 at idx 0 with value=1 (Planet), vt=12 at idx 1 with value=42 (Turing)
        tasks: [{ type: 11, values: [1, 42], valueTypes: [11, 12] }],
        reward: { type: 1, id32: 0, amount: 45 },
        rewards: [],
        flags: 0,
      },
    });
    mockHd2Fetch.mockResolvedValueOnce([assignment]);
    const result = await getAssignments.handler({});
    expect(result.content[0].text).toContain('Turing (42)');
  });

  it('shows progress values', async () => {
    mockHd2Fetch.mockResolvedValueOnce([makeAssignment()]);
    const result = await getAssignments.handler({});
    expect(result.content[0].text).toContain('Progress: 50, 100');
  });

  it('shows expiry in seconds', async () => {
    mockHd2Fetch.mockResolvedValueOnce([makeAssignment()]);
    const result = await getAssignments.handler({});
    expect(result.content[0].text).toContain('Expires in: 86400 seconds');
  });

  it('returns error response on fetch failure', async () => {
    mockHd2Fetch.mockRejectedValueOnce(new Error('API down'));
    const result = await getAssignments.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch assignments');
  });
});
