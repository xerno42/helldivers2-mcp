import {
  RawPlanetEvent,
  RawPlanetInfo,
  RawPlanetRegionInfo,
  RawPlanetRegionStatus,
  RawPlanetStats,
  RawPlanetStatus,
  RawStatsBlock,
  RawWarInfo,
  RawWarStatus,
  RawWarSummary,
} from './api-types.js';
import {
  lookupBiome,
  lookupFaction,
  lookupHazards,
  lookupPlanetName,
  lookupRegion,
  lookupSector,
} from './reference-data.js';
import { WAR_START_TIMESTAMP, toRelativeTime } from './utils.js';

const REGION_SIZE_NAMES: Record<number, string> = {
  0: 'Settlement',
  1: 'Town',
  2: 'City',
  3: 'MegaCity',
};

function rawTimestampToDate(secondsSinceWarStart: number): Date {
  return new Date((WAR_START_TIMESTAMP + secondsSinceWarStart) * 1000);
}

export interface WarSnapshot {
  status: RawWarStatus;
  warInfo: RawWarInfo;
  summary: { galaxy_stats: RawStatsBlock; planets_stats: RawPlanetStats[] };
}

export function findPlanetInfo(snap: WarSnapshot, index: number): RawPlanetInfo | undefined {
  return snap.warInfo.planetInfos.find((p) => p.index === index);
}

export function findPlanetStatus(snap: WarSnapshot, index: number): RawPlanetStatus | undefined {
  return snap.status.planetStatus.find((p) => p.index === index);
}

export function findPlanetEvent(snap: WarSnapshot, index: number): RawPlanetEvent | undefined {
  return snap.status.planetEvents.find((e) => e.planetIndex === index);
}

export function findPlanetStats(snap: WarSnapshot, index: number): RawPlanetStats | undefined {
  return snap.summary.planets_stats.find((s) => s.planetIndex === index);
}

export function findPlanetAttackTargets(snap: WarSnapshot, index: number): number[] {
  return snap.status.planetAttacks.filter((a) => a.source === index).map((a) => a.target);
}

export function findPlanetRegions(
  snap: WarSnapshot,
  index: number,
): Array<{ info?: RawPlanetRegionInfo; status: RawPlanetRegionStatus }> {
  const statuses = snap.status.planetRegions.filter((r) => r.planetIndex === index);
  return statuses.map((status) => ({
    info: snap.warInfo.planetRegions.find(
      (r) => r.planetIndex === status.planetIndex && r.regionIndex === status.regionIndex,
    ),
    status,
  }));
}

function formatEventBlock(event: RawPlanetEvent | undefined): string {
  if (!event) return 'None';
  return (
    `Faction: ${lookupFaction(event.race)}\n` +
    `Current Health: ${event.health}\n` +
    `Max Health: ${event.maxHealth}\n` +
    `Start Time: ${toRelativeTime(rawTimestampToDate(event.startTime))}\n` +
    `End Time: ${toRelativeTime(rawTimestampToDate(event.expireTime))}`
  );
}

function formatStatsBlock(stats: RawPlanetStats | undefined, players: number | undefined): string {
  if (!stats) return 'None';
  return (
    `Missions Won: ${stats.missionsWon}\n` +
    `Missions Lost: ${stats.missionsLost}\n` +
    `Total Mission Time: ${stats.missionTime} seconds\n` +
    `Terminid Kills: ${stats.bugKills}\n` +
    `Automaton Kills: ${stats.automatonKills}\n` +
    `Illuminate Kills: ${stats.illuminateKills}\n` +
    `Bullets Fired: ${stats.bulletsFired}\n` +
    `Bullets Hit: ${stats.bulletsHit}\n` +
    `Accuracy: ${stats.accurracy}%\n` +
    `Time Played: ${stats.timePlayed}\n` +
    `Deaths: ${stats.deaths}\n` +
    `Revives: ${stats.revives}\n` +
    `Friendly Fire Casualties: ${stats.friendlies}\n` +
    `Mission Success Rate: ${stats.missionSuccessRate}%\n` +
    `Player Count: ${players ?? 'Unknown'}`
  );
}

function formatRegions(
  regions: Array<{ info?: RawPlanetRegionInfo; status: RawPlanetRegionStatus }>,
): string {
  if (regions.length === 0) return 'None';
  return regions
    .map(({ info, status }) => {
      const ref = info ? lookupRegion(info.settingsHash) : null;
      const size = info ? REGION_SIZE_NAMES[info.regionSize] ?? String(info.regionSize) : 'Unknown';
      return (
        `Name: ${ref?.name ?? 'Unknown'}\n` +
        `Description: ${ref?.description || 'Unknown'}\n` +
        `Health: ${status.health}\n` +
        `Max Health: ${info?.maxHealth ?? 'Unknown'}\n` +
        `Size: ${size}\n` +
        `Regen Per Second: ${status.regerPerSecond}\n` +
        `Active players: ${status.players}`
      );
    })
    .join('\n---\n');
}

function formatHazards(index: number): string {
  const hazards = lookupHazards(index);
  if (hazards.length === 0) return 'None';
  return hazards
    .map((h) => `Name: ${h.name ?? 'Unknown'} - Description: ${h.description ?? 'Unknown'}`)
    .join('\n---\n');
}

function formatBiome(index: number): string {
  const biome = lookupBiome(index);
  if (!biome) return 'None';
  return `Name: ${biome.name ?? 'Unknown'} - Description: ${biome.description ?? 'Unknown'}`;
}

export function formatPlanetDetails(snap: WarSnapshot, index: number): string {
  const info = findPlanetInfo(snap, index);
  const status = findPlanetStatus(snap, index);
  const event = findPlanetEvent(snap, index);
  const stats = findPlanetStats(snap, index);
  const regions = findPlanetRegions(snap, index);
  const attacking = findPlanetAttackTargets(snap, index);

  const position = info ? `X: ${info.position.x}; Y: ${info.position.y}` : 'None';
  const waypoints =
    info && info.waypoints.length > 0 ? info.waypoints.join(', ') : 'None';
  const attackingStr = attacking.length > 0 ? attacking.join(', ') : 'None';

  return (
    `Id: ${index}\n` +
    `Name: ${lookupPlanetName(index)}\n` +
    `Sector: ${lookupSector(index)}\n` +
    `Biome: ${formatBiome(index)}\n` +
    `Hazards: ${formatHazards(index)}\n` +
    `Position: ${position}\n` +
    `Waypoints: ${waypoints}\n` +
    `Max Health: ${info?.maxHealth ?? 'Unknown'}\n` +
    `Health: ${status?.health ?? 'Unknown'}\n` +
    `Initial Owner: ${info ? lookupFaction(info.initialOwner) : 'Unknown'}\n` +
    `Current Owner: ${status ? lookupFaction(status.owner) : 'Unknown'}\n` +
    `Regen Per Second: ${status?.regenPerSecond ?? 'Unknown'}\n` +
    `Attacking: ${attackingStr}\n` +
    `----------\n` +
    `Event:\n${formatEventBlock(event)}\n` +
    `----------\n` +
    `Statistics:\n${formatStatsBlock(stats, status?.players)}\n` +
    `----------\n` +
    `Regions:\n${formatRegions(regions)}`
  );
}

export function formatActivePlanetSummary(snap: WarSnapshot, index: number): string {
  const info = findPlanetInfo(snap, index);
  const status = findPlanetStatus(snap, index);
  const event = findPlanetEvent(snap, index);
  const attacking = findPlanetAttackTargets(snap, index);
  const regions = findPlanetRegions(snap, index).filter((r) => r.status.players > 0);

  const attackingStr =
    attacking.length > 0
      ? attacking.map((id) => `Id: ${id}, Name: ${lookupPlanetName(id)}`).join(', ')
      : 'None';

  const regionsStr =
    regions.length > 0
      ? regions
          .map(({ info: regionInfo, status: regionStatus }) => {
            const ref = regionInfo ? lookupRegion(regionInfo.settingsHash) : null;
            const size = regionInfo
              ? REGION_SIZE_NAMES[regionInfo.regionSize] ?? String(regionInfo.regionSize)
              : 'Unknown';
            return (
              `\tName: ${ref?.name ?? 'Unknown'}\n` +
              `\tHealth: ${regionStatus.health}\n` +
              `\tMax Health: ${regionInfo?.maxHealth ?? 'Unknown'}\n` +
              `\tRegen Per Second: ${regionStatus.regerPerSecond}\n` +
              `\tSize: ${size}\n` +
              `\tActive Players: ${regionStatus.players}`
            );
          })
          .join('\n\t---\n')
      : 'None';

  return (
    `Name: ${lookupPlanetName(index)}\n` +
    `Sector: ${lookupSector(index)}\n` +
    `Initial Owner: ${info ? lookupFaction(info.initialOwner) : 'Unknown'}\n` +
    `Current Owner: ${status ? lookupFaction(status.owner) : 'Unknown'}\n` +
    `Player Count: ${status?.players ?? 'Unknown'}\n` +
    `Event:\n${formatEventBlock(event)}\n` +
    `Attacking: ${attackingStr}\n` +
    `Active Regions:\n${regionsStr}`
  );
}

export async function loadWarSnapshot(
  fetcher: <T>(path: string) => Promise<T>,
): Promise<WarSnapshot> {
  const [status, warInfo, summary] = await Promise.all([
    fetcher<RawWarStatus>('/raw/api/WarSeason/801/Status'),
    fetcher<RawWarInfo>('/raw/api/WarSeason/801/WarInfo'),
    fetcher<RawWarSummary>('/raw/api/Stats/war/801/summary'),
  ]);
  return {
    status,
    warInfo,
    summary: {
      galaxy_stats: summary.galaxy_stats,
      planets_stats: summary.planets_stats ?? [],
    },
  };
}
