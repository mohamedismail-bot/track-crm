import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { SYSTEM_FIELD_DEFINITIONS } from "./constants";
import type { CreatorField } from "@prisma/client";

export interface CreatorFieldDef {
  id: string | null;
  key: string | null;
  label: string;
  type: string;
  required: boolean;
  order: number;
  options: string[];
}

/** Parse a CreatorField.options TEXT column as a string[] (JS values). */
export function parseFieldOptions(row: { options?: string | null }): string[] {
  if (!row.options) return [];
  try {
    const parsed = JSON.parse(row.options);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function serializeFieldOptions(values: string[]): string | null {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  return clean.length ? JSON.stringify(clean) : null;
}

/**
 * Seed the built-in creator fields. Idempotent, safe to call on every boot of
 * helpers that need a complete field set.
 */
export async function ensureSystemFields(): Promise<CreatorField[]> {
  const existing = await prisma.creatorField.findMany();
  const existingKeys = new Set(existing.map((f) => f.key));
  const missing = SYSTEM_FIELD_DEFINITIONS.filter((d) => !existingKeys.has(d.key));
  if (missing.length) {
    await prisma.creatorField.createMany({
      data: missing.map((d) => ({
        key: d.key,
        label: d.label,
        type: d.type,
        required: d.required,
        order: d.order,
        isSystem: true,
      })),
    });
  }
  return existing.length ? existing : prisma.creatorField.findMany({ orderBy: { order: "asc" } });
}

/**
 * Effective creator field set: system defaults merged with any persisted rows
 * (system rows keep the DB's required/order), followed by custom fields.
 */
export async function listCreatorFields(): Promise<CreatorFieldDef[]> {
  await ensureSystemFields();
  const rows = await prisma.creatorField.findMany({ orderBy: [{ isSystem: "desc" as const }, { order: "asc" as const }] });
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    type: r.type,
    required: r.required,
    order: r.order,
    options: parseFieldOptions(r),
  }));
}

export async function listCountriesWithCities() {
  return prisma.country.findMany({
    include: { cities: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function listCreatorTypes() {
  return prisma.creatorType.findMany({ orderBy: { name: "asc" } });
}

export async function getGenderOptions(): Promise<string[]> {
  const settings = await getSettings();
  return settings.genderOptions;
}

export interface ReferencePayload {
  countries: Awaited<ReturnType<typeof listCountriesWithCities>>;
  creatorTypes: Awaited<ReturnType<typeof listCreatorTypes>>;
  fields: CreatorFieldDef[];
  genderOptions: string[];
  approvalEnabled: boolean;
}

export async function getReferencePayload(): Promise<ReferencePayload> {
  const [countries, creatorTypes, fields, genderOptions, settings] = await Promise.all([
    listCountriesWithCities(),
    listCreatorTypes(),
    listCreatorFields(),
    getGenderOptions(),
    getSettings(),
  ]);
  return { countries, creatorTypes, fields, genderOptions, approvalEnabled: settings.approvalEnabled };
}

/** Convenience: find a country by id with its dial code. */
export async function getCountry(id: string) {
  return prisma.country.findUnique({ where: { id } });
}

export async function getNameOfCountryOrLegacy(countryId: string | null, legacy: string | null) {
  if (countryId) return (await prisma.country.findUnique({ where: { id: countryId } }))?.name ?? legacy;
  return legacy;
}