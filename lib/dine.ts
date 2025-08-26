// /lib/dine.ts
export type MenuItem = {
  id: string;
  name: string;
  station?: string;
  meal_period?: string;
  serving_name?: string;
  serving_size_g?: number; // undefined if unknown
  per_serving_kcal: number;
  per_serving_protein_g: number;
  per_serving_carb_g: number;
  per_serving_fat_g: number;
  per_serving_fiber_g?: number;
  // computed if serving_size_g known
  per_100g_kcal?: number;
  per_100g_protein_g?: number;
  per_100g_carb_g?: number;
  per_100g_fat_g?: number;
  // scores
  protein_density?: number;     // higher = more protein per 100 kcal
  fat_efficiency?: number;      // lower = leaner
  fiber_per_100kcal?: number;
};

const OUNCE_TO_G = 28.3495;
const FLOZ_TO_ML = 29.5735;
const DENSITY_G_PER_ML = 1.0;

// ---------- helpers ----------
function asNum(x: unknown): number | undefined {
  if (x == null) return undefined;
  if (typeof x === "number" && !Number.isNaN(x)) return x;
  const s = String(x).trim().toLowerCase();
  if (s === "" || s === "-") return undefined;
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}
function pickNutrient(nutrients: any[] | undefined, name: string): number {
  const n = (nutrients ?? []).find((z: any) => z?.name === name);
  return (asNum(n?.value_numeric) ?? asNum(n?.value) ?? 0) as number;
}
function servingToGrams(portion?: string | null): number | undefined {
  if (!portion) return undefined;
  const s = portion.toLowerCase().trim();
  let m = s.match(/^(\d+(\.\d+)?)\s*floz$/);
  if (m) return parseFloat(m[1]) * FLOZ_TO_ML * DENSITY_G_PER_ML;
  m = s.match(/^(\d+(\.\d+)?)\s*(oz|ounce|ounces)$/);
  if (m) return parseFloat(m[1]) * OUNCE_TO_G;
  m = s.match(/^(\d+(\.\d+)?)\s*g(ram|)$/);
  if (m) return parseFloat(m[1]);
  return undefined;
}
function per100(perServing: number, grams?: number): number | undefined {
  if (!grams || grams <= 0) return undefined;
  return perServing * (100 / grams);
}
function applyScores(it: MenuItem): void {
  const kcal = Math.max(it.per_serving_kcal, 1);
  const pCal = it.per_serving_protein_g * 4;
  const fCal = it.per_serving_fat_g * 9;
  const fiber = it.per_serving_fiber_g ?? 0;
  it.protein_density = (pCal / kcal) * 100;
  it.fat_efficiency = (fCal / kcal) * 100;
  it.fiber_per_100kcal = (fiber * 100) / kcal;
}
// --------------------------------

export function normalizePeriodsPayload(payload: any): MenuItem[] {
  const out: MenuItem[] = [];
  const periods = payload?.menu?.periods;
  const plist = Array.isArray(periods) ? periods : periods ? [periods] : [];
  for (const p of plist) {
    const periodName = p?.name ?? "";
    for (const cat of p?.categories ?? []) {
      const station = cat?.name ?? "";
      for (const it of cat?.items ?? []) {
        const kcal  = pickNutrient(it.nutrients, "Calories");
        const prot  = pickNutrient(it.nutrients, "Protein (g)");
        const carb  = pickNutrient(it.nutrients, "Total Carbohydrates (g)");
        const fat   = pickNutrient(it.nutrients, "Total Fat (g)");
        const fiber = pickNutrient(it.nutrients, "Dietary Fiber (g)");
        const grams = servingToGrams(it.portion);

        const rec: MenuItem = {
          id: String(it.id ?? it.mrn ?? it.webtrition_id ?? crypto.randomUUID()),
          name: String(it.name ?? ""),
          station,
          meal_period: periodName,
          serving_name: it.portion ?? "",
          serving_size_g: grams,
          per_serving_kcal: Number(kcal || 0),
          per_serving_protein_g: Number(prot || 0),
          per_serving_carb_g: Number(carb || 0),
          per_serving_fat_g: Number(fat || 0),
          per_serving_fiber_g: Number(fiber || 0),
          per_100g_kcal: per100(kcal, grams),
          per_100g_protein_g: per100(prot, grams),
          per_100g_carb_g: per100(carb, grams),
          per_100g_fat_g: per100(fat, grams),
        };
        applyScores(rec);
        out.push(rec);
      }
    }
  }
  // de-dupe by name+station+serving_size_g
  const seen = new Set<string>();
  return out.filter((r) => {
    const key = `${r.name.toLowerCase()}|${(r.station || "").toLowerCase()}|${Math.round((r.serving_size_g ?? -1) * 1000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
