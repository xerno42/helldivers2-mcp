import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_DIR = path.resolve(__dirname, '..', 'static');

export interface PlanetRef {
  name?: string;
  sector?: string;
  biome?: string;
  environmentals?: string[];
}

export interface NamedDescribed {
  name?: string;
  description?: string;
}

export interface PlanetRegionRef extends NamedDescribed {
  region_faction?: string;
  region_type?: string;
}

export interface PlanetEffectRef extends NamedDescribed {
  galacticEffectId?: number;
}

export interface ItemNameRef {
  name?: string;
  mix_id?: string;
}

export interface ReferenceData {
  planets: Record<string, PlanetRef>;
  biomes: Record<string, NamedDescribed>;
  environmentals: Record<string, NamedDescribed>;
  planetRegions: Record<string, PlanetRegionRef>;
  factions: Record<string, string>;
  planetEffects: Record<string, PlanetEffectRef>;
  itemNames: Record<string, ItemNameRef>;
}

let cache: ReferenceData | null = null;

function readJson<T>(relativePath: string): T | null {
  const filePath = path.join(JSON_DIR, relativePath);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[reference-data] Failed to read ${relativePath}: ${(err as Error).message}`);
    return null;
  }
}

export function getReferenceData(): ReferenceData {
  if (cache) return cache;
  cache = {
    planets: readJson<Record<string, PlanetRef>>('planets/planets.json') ?? {},
    biomes: readJson<Record<string, NamedDescribed>>('planets/biomes.json') ?? {},
    environmentals: readJson<Record<string, NamedDescribed>>('planets/environmentals.json') ?? {},
    planetRegions: readJson<Record<string, PlanetRegionRef>>('planets/planetRegion.json') ?? {},
    factions: readJson<Record<string, string>>('factions.json') ?? {},
    planetEffects: readJson<Record<string, PlanetEffectRef>>('effects/planetEffects.json') ?? {},
    itemNames: readJson<Record<string, ItemNameRef>>('items/item_names.json') ?? {},
  };
  return cache;
}

export function lookupPlanetName(index: number): string {
  const ref = getReferenceData().planets[String(index)];
  return ref?.name ?? 'Unknown';
}

export function lookupSector(index: number): string {
  const ref = getReferenceData().planets[String(index)];
  return ref?.sector ?? 'Unknown';
}

export function lookupBiome(index: number): NamedDescribed | null {
  const ref = getReferenceData();
  const planet = ref.planets[String(index)];
  if (!planet?.biome) return null;
  return ref.biomes[planet.biome] ?? null;
}

export function lookupHazards(index: number): NamedDescribed[] {
  const ref = getReferenceData();
  const planet = ref.planets[String(index)];
  if (!planet?.environmentals) return [];
  return planet.environmentals
    .map((key) => ref.environmentals[key])
    .filter((h): h is NamedDescribed => Boolean(h && h.name && h.name !== 'None'));
}

export function lookupFaction(id: number): string {
  return getReferenceData().factions[String(id)] ?? 'Unknown';
}

export function lookupRegion(hash: number | string): PlanetRegionRef | null {
  return getReferenceData().planetRegions[String(hash)] ?? null;
}

export function lookupEffect(id: number): PlanetEffectRef | null {
  return getReferenceData().planetEffects[String(id)] ?? null;
}

export function lookupItem(id: number | string): ItemNameRef | null {
  return getReferenceData().itemNames[String(id)] ?? null;
}
