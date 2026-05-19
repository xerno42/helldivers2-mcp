import { hd2Fetch } from '../client.js';
import { RawAssignment, RawAssignmentTask } from '../api-types.js';
import {
  AssignmentDifficultyLevels,
  AssignmentLocationTypes,
  AssignmentRewardTypes,
  AssignmentTypes,
  AssignmentValueTypes,
  Races,
} from '../enums.js';
import { lookupPlanetName } from '../reference-data.js';
import { Tool } from '../tool-types.js';
import { errorResponse, textResponse } from '../utils.js';

function formatTaskValues(task: RawAssignmentTask): string {
  const valueTypes = task.valueTypes ?? [];
  if (valueTypes.length === 0) return 'No value information available';

  return valueTypes
    .map((vt, idx) => {
      const typeLabel = AssignmentValueTypes[vt] ?? `type_${vt}`;
      const rawValue = task.values?.[idx];
      let display: string | number = rawValue ?? 'Unknown';
      if (rawValue !== undefined) {
        if (vt === 1) display = Races[rawValue] ?? rawValue;
        else if (vt === 9) display = AssignmentDifficultyLevels[rawValue] ?? rawValue;
        else if (vt === 11) display = AssignmentLocationTypes[rawValue] ?? rawValue;
        else if (vt === 12) {
          // Resolve the planet name only when the task pairs vt 12 (location_index) with vt 11
          // (location_type) == 1 (Planet). If Arrowhead ever emits multiple location entries in
          // one task, this pairs the index with the first location_type - revisit if that happens.
          const locationTypeIdx = valueTypes.findIndex((t) => t === 11);
          const locationType = locationTypeIdx >= 0 ? task.values?.[locationTypeIdx] : undefined;
          if (locationType === 1) display = `${lookupPlanetName(rawValue)} (${rawValue})`;
        }
      }
      return `${typeLabel}: ${display}`;
    })
    .join(', ');
}

function formatAssignment(a: RawAssignment): string {
  const tasks = a.setting?.tasks ?? [];
  const tasksStr =
    tasks.length > 0
      ? tasks
          .map((t) => `\tType: ${AssignmentTypes[t.type] ?? t.type}, ${formatTaskValues(t)}`)
          .join('\n')
      : 'No tasks information available';

  const progressStr =
    a.progress && a.progress.length > 0 ? a.progress.join(', ') : 'No progress information available';

  const reward = a.setting?.reward;
  const rewardStr = reward
    ? `${AssignmentRewardTypes[reward.type] ?? `type_${reward.type}`} - Amount: ${reward.amount}`
    : 'No reward information available';

  return (
    `Title: ${a.setting?.overrideTitle || 'No title'}\n` +
    `Briefing: ${a.setting?.overrideBrief || 'No description'}\n` +
    `Task Description: ${a.setting?.taskDescription || 'No task description'}\n` +
    `Tasks:\n${tasksStr}\n` +
    `Progress: ${progressStr}\n` +
    `Reward: ${rewardStr}\n` +
    `Expires in: ${a.expiresIn ?? 'Unknown'} seconds`
  );
}

export const getAssignments: Tool = {
  definition: {
    name: 'get_assignments',
    title: 'Get Assignments',
    description:
      'Fetch the currently active assignments (Major Orders) issued by Super Earth high command. Returns each assignment with title, briefing, task description, decoded task list (type and value information including races, difficulties, and target planet names), current progress numbers, reward (type and amount), and expiration (seconds until expiry).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  handler: async () => {
    try {
      const assignments = await hd2Fetch<RawAssignment[]>('/raw/api/v2/Assignment/War/801');
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return textResponse('No active assignments.');
      }
      const text = assignments.map(formatAssignment).join('\n---\n');
      return textResponse(text);
    } catch (err) {
      return errorResponse(`Failed to fetch assignments: ${(err as Error).message}`);
    }
  },
};
