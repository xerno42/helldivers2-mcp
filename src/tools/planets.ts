import { hd2Fetch } from '../client.js';
import { formatPlanetDetails, loadWarSnapshot } from '../format-planet.js';
import { getReferenceData } from '../reference-data.js';
import { Tool } from '../tool-types.js';
import { errorResponse, textResponse } from '../utils.js';

const MAX_PLANET_DETAILS = 5;

export const getAllPlanets: Tool = {
  definition: {
    name: 'get_all_planets',
    title: 'Get All Planets',
    description:
      'Fetch a list of all planets in the current galactic war. Returns a list of planets with their id (index), name, and sector.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  handler: async () => {
    const { planets } = getReferenceData();
    const entries = Object.keys(planets)
      .map((k) => ({ id: parseInt(k, 10), ref: planets[k] }))
      .filter((e) => !isNaN(e.id))
      .sort((a, b) => a.id - b.id);

    if (entries.length === 0) {
      return errorResponse('No planets found. Reference data may not be available.');
    }

    const data = entries
      .map((e) => `Id: ${e.id}\nName: ${e.ref.name ?? 'Unknown'}\nSector: ${e.ref.sector ?? 'Unknown'}`)
      .join('\n---\n');
    return textResponse(data);
  },
};

export const getPlanetDetails: Tool = {
  definition: {
    name: 'get_planet_details',
    title: 'Get Planet Details',
    description:
      'Fetch detailed information about one or more planets by providing their planet index/indices. Requires: planetindices parameter (array of integers of planet indices, maximum of 5) Returns: For each planet - index, name, sector, biome (Biome: name, description), hazards (Hazard: name, description), position, list of waypoints (planet indices) the planet is connected to, max health, current health, initial owner, current owner, regen per second, event information if one is active (faction who initiated the event, current health, max health, start and end time), statistics (Statistics: missions won, missions lost, mission time, terminid kills, automaton kills, illuminate kills, bullets fired, bullets hit, time played, deaths, revives, friendly fire casualties, mission success rate, accuracy, player count), attacking (a list of planet indices this planet is currently attacking), regions (Region: name, description, health, max health, size, regen per second, active players).',
    inputSchema: {
      type: 'object',
      properties: {
        planetindices: {
          type: 'array',
          description: 'A list of planet indices to get detailed information for.',
          items: { type: 'integer' },
        },
      },
      required: ['planetindices'],
      additionalProperties: false,
    },
  },
  handler: async (args) => {
    const raw = args.planetindices;
    if (!Array.isArray(raw) || raw.length === 0) {
      return errorResponse('planetindices must be a non-empty array of integers.');
    }
    if (raw.length > MAX_PLANET_DETAILS) {
      return errorResponse(
        `Too many planet indices: ${raw.length}. Maximum allowed is ${MAX_PLANET_DETAILS}.`,
      );
    }

    const indices: number[] = [];
    for (const v of raw) {
      let n: number;
      if (typeof v === 'number') {
        n = v;
      } else if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) {
        n = parseInt(v, 10);
      } else {
        return errorResponse(`Invalid planet index: ${JSON.stringify(v)}. Must be an integer.`);
      }
      if (!Number.isInteger(n)) {
        return errorResponse(`Invalid planet index: ${JSON.stringify(v)}. Must be an integer.`);
      }
      indices.push(n);
    }

    try {
      const snap = await loadWarSnapshot(hd2Fetch);
      const validIndexSet = new Set(snap.warInfo.planetInfos.map((p) => p.index));
      const allIndices = Array.from(validIndexSet).sort((a, b) => a - b);
      const minIdx = allIndices[0];
      const maxIdx = allIndices[allIndices.length - 1];

      for (const idx of indices) {
        if (!validIndexSet.has(idx)) {
          return errorResponse(`Planet index ${idx} not found. Valid range: ${minIdx}–${maxIdx}.`);
        }
      }

      const data = indices.map((idx) => formatPlanetDetails(snap, idx)).join('\n----------\n');
      return textResponse(data);
    } catch (err) {
      return errorResponse(`Failed to fetch planet details: ${(err as Error).message}`);
    }
  },
};
