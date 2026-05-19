export const Races: Record<number, string> = {
  1: 'Humans',
  2: 'Terminids',
  3: 'Automatons',
  4: 'Illuminate',
};

export const AssignmentTypes: Record<number, string> = {
  2: 'Extract',
  3: 'Eradicate',
  7: 'Complete Missions',
  9: 'Complete Operations',
  11: 'Liberation',
  12: 'Defense',
  13: 'Control',
  15: 'Expand',
};

export const AssignmentRewardTypes: Record<number, string> = {
  1: 'Medals',
};

export const AssignmentDifficultyLevels: Record<number, string> = {
  0: '0 - Any',
  1: '1 - Trivial',
  2: '2 - Easy',
  3: '3 - Medium',
  4: '4 - Challenging',
  5: '5 - Hard',
  6: '6 - Extreme',
  7: '7 - Suicide Mission',
  8: '8 - Impossible',
  9: '9 - Helldive',
  10: '10 - Super Helldive',
};

export const AssignmentLocationTypes: Record<number, string> = {
  1: 'Planet',
};

export const AssignmentValueTypes: Record<number, string> = {
  1: 'race',
  2: 'unknown',
  3: 'goal',
  4: 'unit_id',
  5: 'item_id',
  9: 'difficulty',
  11: 'location_type',
  12: 'location_index',
};

export const TacticalActionStatusTypes: Record<number, string> = {
  1: 'Preparing',
  2: 'Active',
  3: 'On cooldown',
};
