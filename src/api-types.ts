// Shapes returned by the `/raw` endpoints of api.helldivers2.dev.

export interface RawPlanetCoordinates { x: number; y: number; }

export interface RawPlanetInfo {
  index: number;
  settingsHash: number;
  position: RawPlanetCoordinates;
  waypoints: number[];
  sector: number;
  maxHealth: number;
  disabled: boolean;
  initialOwner: number;
}

export interface RawPlanetRegionInfo {
  planetIndex: number;
  regionIndex: number;
  settingsHash: number;
  maxHealth: number;
  regionSize: number;
}

export interface RawHomeWorld {
  race: number;
  planetIndices: number[];
}

export interface RawWarInfo {
  warId: number;
  startDate: number;
  endDate: number;
  minimumClientVersion?: string;
  planetInfos: RawPlanetInfo[];
  homeWorlds: RawHomeWorld[];
  planetRegions: RawPlanetRegionInfo[];
}

export interface RawPlanetStatus {
  index: number;
  owner: number;
  health: number;
  regenPerSecond: number;
  players: number;
}

export interface RawPlanetAttack {
  source: number;
  target: number;
}

export interface RawCampaign {
  id: number;
  planetIndex: number;
  type: number;
  count: number;
  race: number;
}

export interface RawJointOperation {
  id: number;
  planetIndex: number;
  hqNodeIndex: number;
}

export interface RawPlanetEvent {
  id: number;
  planetIndex: number;
  eventType: number;
  race: number;
  health: number;
  maxHealth: number;
  startTime: number;
  expireTime: number;
  campaignId: number;
  jointOperationIds: number[];
}

export interface RawPlanetRegionStatus {
  planetIndex: number;
  regionIndex: number;
  owner: number;
  health: number;
  regerPerSecond: number;
  availabilityFactor: number;
  isAvailable: boolean;
  players: number;
}

export interface RawWarStatus {
  warId: number;
  time: number;
  impactMultiplier: number;
  storyBeatId32: number;
  planetStatus: RawPlanetStatus[];
  planetAttacks: RawPlanetAttack[];
  campaigns: RawCampaign[];
  jointOperations: RawJointOperation[];
  planetEvents: RawPlanetEvent[];
  planetRegions: RawPlanetRegionStatus[];
}

export interface RawStatsBlock {
  missionsWon: number;
  missionsLost: number;
  missionTime: number;
  bugKills: number;
  automatonKills: number;
  illuminateKills: number;
  bulletsFired: number;
  bulletsHit: number;
  timePlayed: number;
  deaths: number;
  revives: number;
  friendlies: number;
  missionSuccessRate: number;
  // sic — the raw API field is misspelled as "accurracy".
  accurracy: number;
}

export interface RawPlanetStats extends RawStatsBlock {
  planetIndex: number;
}

export interface RawWarSummary {
  galaxy_stats: RawStatsBlock;
  planets_stats: RawPlanetStats[];
}

export interface RawNewsFeedItem {
  id: number;
  published: number;
  type: number;
  message: string;
}

export interface RawAssignmentTask {
  type: number;
  values: number[];
  valueTypes: number[];
}

export interface RawAssignmentReward {
  type: number;
  id32: number;
  amount: number;
}

export interface RawAssignmentSetting {
  type: number;
  overrideTitle: string;
  overrideBrief: string;
  taskDescription: string;
  tasks: RawAssignmentTask[];
  reward?: RawAssignmentReward | null;
  rewards?: (RawAssignmentReward | null)[];
  flags: number;
}

export interface RawAssignment {
  id32: number;
  progress: number[];
  expiresIn: number;
  setting: RawAssignmentSetting;
}

// Shapes from /api/v1 (Steam) and /api/v2 (SpaceStation) — used only where /raw isn't viable.

export interface SteamNewsItem {
  id: string;
  title: string;
  url: string;
  author: string;
  content: string;
  publishedAt: string;
}

export interface ApiV2TacticalActionCost {
  id: string;
  itemMixId: number;
  targetValue: number;
  currentValue: number;
  deltaPerSecond: number;
  maxDonationAmmount: number;
  maxDonationPeriodSeconds: number;
}

export interface ApiV2TacticalAction {
  id32: number;
  mediaId32: number;
  name: string;
  description: string;
  strategicDescription: string;
  status: number;
  statusExpire: string;
  costs: ApiV2TacticalActionCost[];
  effectIds: number[];
}

export interface ApiV2SpaceStation {
  id32: number;
  planet: { index: number };
  electionEnd: string;
  flags: number;
  tacticalActions: ApiV2TacticalAction[];
}
