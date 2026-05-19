import { hd2Fetch } from '../client.js';
import { RawStatsBlock } from '../api-types.js';
import { formatActivePlanetSummary, loadWarSnapshot } from '../format-planet.js';
import { Tool } from '../tool-types.js';
import { errorResponse, textResponse } from '../utils.js';

function formatGalaxyStats(
  stats: RawStatsBlock,
  impactMultiplier: number,
  totalPlayers: number,
): string {
  return (
    `Impact Multiplier: ${impactMultiplier}\n` +
    `Missions Won: ${stats.missionsWon}\n` +
    `Missions Lost: ${stats.missionsLost}\n` +
    `Total Mission Time: ${stats.missionTime} seconds\n` +
    `Terminid Kills: ${stats.bugKills}\n` +
    `Automaton Kills: ${stats.automatonKills}\n` +
    `Illuminate Kills: ${stats.illuminateKills}\n` +
    `Bullets Fired: ${stats.bulletsFired}\n` +
    `Bullets Hit: ${stats.bulletsHit}\n` +
    `Accuracy: ${stats.accurracy}%\n` +
    `Deaths: ${stats.deaths}\n` +
    `Revives: ${stats.revives}\n` +
    `Friendly Fire Casualties: ${stats.friendlies}\n` +
    `Mission Success Rate: ${stats.missionSuccessRate}%\n` +
    `Player Count: ${totalPlayers}`
  );
}

export const getWarStatus: Tool = {
  definition: {
    name: 'get_war_status',
    title: 'Get War Status',
    description:
      'Fetch the current war status and active planets. Returns aggregated war statistics (impact multiplier, total missions won, total missions lost, total mission time, total terminid kills, total automaton kills, total illuminate kills, total bullets fired, total bullets hit, total deaths, total revives, total friendly fire casualties, overall mission success rate, overall accuracy), and a list of active planets (planets with active players or ownership change) with their name, sector, initial owner, current owner, player count, active event information if any (Event: faction, current health, max health, start and end time), the planets each active planet is currently attacking (id and name), and active regions (Region: name, health, max health, regen per second, size, active players).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  handler: async () => {
    try {
      const snap = await loadWarSnapshot(hd2Fetch);
      const totalPlayers = snap.status.planetStatus.reduce((sum, p) => sum + (p.players ?? 0), 0);
      const statistics = formatGalaxyStats(
        snap.summary.galaxy_stats,
        snap.status.impactMultiplier,
        totalPlayers,
      );

      const activeIndices = new Set<number>();
      for (const ps of snap.status.planetStatus) {
        const info = snap.warInfo.planetInfos.find((p) => p.index === ps.index);
        const isDamaged = info ? ps.health < info.maxHealth : false;
        const hasPlayers = ps.players > 0;
        if (hasPlayers || isDamaged) activeIndices.add(ps.index);
      }
      for (const e of snap.status.planetEvents) activeIndices.add(e.planetIndex);

      const activePlanets =
        activeIndices.size > 0
          ? Array.from(activeIndices)
              .sort((a, b) => a - b)
              .map((idx) => formatActivePlanetSummary(snap, idx))
              .join('\n---\n')
          : 'No active planets.';

      const text =
        `War Statistics:\n${statistics}\n` +
        `----------\n` +
        `Active Planets:\n${activePlanets}`;

      return textResponse(text);
    } catch (err) {
      return errorResponse(`Failed to fetch war status: ${(err as Error).message}`);
    }
  },
};
