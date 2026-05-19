import { describe, it, expect } from '@jest/globals';
import {
  Races,
  AssignmentTypes,
  AssignmentRewardTypes,
  AssignmentDifficultyLevels,
  AssignmentValueTypes,
  TacticalActionStatusTypes,
} from '../enums.js';

describe('Races', () => {
  it('maps 2 to Terminids', () => {
    expect(Races[2]).toBe('Terminids');
  });

  it('maps 3 to Automatons', () => {
    expect(Races[3]).toBe('Automatons');
  });
});

describe('AssignmentDifficultyLevels', () => {
  it('maps 9 to "9 - Helldive"', () => {
    expect(AssignmentDifficultyLevels[9]).toBe('9 - Helldive');
  });

  it('maps 0 to "0 - Any"', () => {
    expect(AssignmentDifficultyLevels[0]).toBe('0 - Any');
  });
});

describe('TacticalActionStatusTypes', () => {
  it('maps 1 to Preparing', () => {
    expect(TacticalActionStatusTypes[1]).toBe('Preparing');
  });

  it('maps 3 to On cooldown', () => {
    expect(TacticalActionStatusTypes[3]).toBe('On cooldown');
  });
});

describe('AssignmentValueTypes', () => {
  it('maps 1 to race', () => {
    expect(AssignmentValueTypes[1]).toBe('race');
  });

  it('maps 12 to location_index', () => {
    expect(AssignmentValueTypes[12]).toBe('location_index');
  });
});

describe('AssignmentTypes', () => {
  it('maps 11 to Liberation', () => {
    expect(AssignmentTypes[11]).toBe('Liberation');
  });
});

describe('AssignmentRewardTypes', () => {
  it('maps 1 to Medals', () => {
    expect(AssignmentRewardTypes[1]).toBe('Medals');
  });
});
