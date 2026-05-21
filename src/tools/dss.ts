import { hd2Fetch } from '../client.js';
import { ApiV2SpaceStation, ApiV2TacticalAction } from '../api-types.js';
import { TacticalActionStatusTypes } from '../enums.js';
import { formatPlanetDetails, loadWarSnapshot } from '../format-planet.js';
import { lookupEffect, lookupItem } from '../reference-data.js';
import { Tool } from '../tool-types.js';
import { errorResponse, stripItalic, stripSpan, textResponse, toRelativeTime } from '../utils.js';

function formatTacticalAction(action: ApiV2TacticalAction): string {
  const effects =
    action.effectIds && action.effectIds.length > 0
      ? action.effectIds
          .map((id) => {
            const effect = lookupEffect(id);
            if (effect) {
              return `Name: ${effect.name ?? 'Unknown'}, Description: ${stripItalic(effect.description ?? '') || 'Unknown'}`;
            }
            return `Effect ID ${id} information not found.`;
          })
          .join('\n\t')
      : 'No planet effects information available';

  const costs =
    action.costs && action.costs.length > 0
      ? action.costs
          .map((c) => {
            const item = lookupItem(c.itemMixId);
            return (
              `Item: ${item?.name ?? 'Unknown'}, ` +
              `Current Value: ${c.currentValue}, ` +
              `Delta Per Second: ${c.deltaPerSecond}, ` +
              `Max Donation Amount: ${c.maxDonationAmmount}`
            );
          })
          .join('\n\t')
      : 'Cost information not available';

  const statusExpire = action.statusExpire
    ? toRelativeTime(new Date(action.statusExpire))
    : 'Unknown';

  return (
    `Name: ${action.name ?? 'Unknown'}\n` +
    `Description: ${action.description ?? 'Unknown'}\n` +
    `Strategic Description: ${stripSpan(action.strategicDescription ?? '') || 'Unknown'}\n` +
    `Status: ${TacticalActionStatusTypes[action.status] ?? 'Unknown'}\n` +
    `Status Expire: ${statusExpire}\n` +
    `Effects:\n\t${effects}\n` +
    `Costs:\t${costs}`
  );
}

export const getSpaceStationDetails: Tool = {
  definition: {
    name: 'get_space_station_details',
    title: 'Get Space Station Details',
    description:
      "Fetch the current Democracy Space Station (DSS) details. Returns the planet the DSS is currently supporting (full planet details), election end (relative time until the next planet vote ends), and a list of active tactical actions (Tactical action: name, description, strategic description, status, status expire, effects (Effect: name, description), costs (Cost: item name, current value, delta per second, max donation amount)).",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  handler: async () => {
    try {
      const [stations, snap] = await Promise.all([
        hd2Fetch<ApiV2SpaceStation[]>('/api/v2/space-stations'),
        loadWarSnapshot(hd2Fetch),
      ]);
      if (!Array.isArray(stations) || stations.length === 0) {
        return errorResponse('No space stations found.');
      }

      const blocks = stations.map((station) => {
        const planetIndex = station.planet?.index;
        const planetDetails =
          planetIndex !== undefined ? formatPlanetDetails(snap, planetIndex) : 'None';
        const electionEnd = station.electionEnd
          ? toRelativeTime(new Date(station.electionEnd))
          : 'Unknown';
        const actions =
          station.tacticalActions && station.tacticalActions.length > 0
            ? station.tacticalActions.map(formatTacticalAction).join('\n---\n')
            : 'None';

        return (
          `Election End: ${electionEnd}\n` +
          `----------\n` +
          `Planet Info:\n${planetDetails}\n` +
          `----------\n` +
          `Tactical Actions:\n${actions}`
        );
      });

      return textResponse(blocks.join('\n==========\n'));
    } catch (err) {
      return errorResponse(`Failed to fetch space station details: ${(err as Error).message}`);
    }
  },
};
