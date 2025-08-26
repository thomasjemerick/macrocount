// app/api/menu/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOCATION_ID = "66c79443351d5300dddee979"; // LSU LaVille (adjust if needed)

async function getJSON(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "MacroCount/1.0 (+vercel)",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} -> ${res.status} ${text}`);
  }
  return res.json();
}

function pickNumber(x: any): number {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// supports both Webtrition "nutrients" array and flat "nutrition" object
function extractMacros(item: any) {
  // shape A: { nutrition: { calories, protein, carbs, fat } }
  if (item?.nutrition) {
    return {
      kcal: pickNumber(item.nutrition.calories),
      protein_g: pickNumber(item.nutrition.protein),
      carb_g: pickNumber(item.nutrition.carbs),
      fat_g: pickNumber(item.nutrition.fat),
    };
  }
  // shape B: { nutrients: [{ name, value_numeric }, ...] }
  if (Array.isArray(item?.nutrients)) {
    const byName = new Map<string, any>();
    for (const n of item.nutrients) {
      if (n?.name) byName.set(String(n.name).toLowerCase(), n);
    }
    const num = (key: string) => pickNumber(byName.get(key)?.value_numeric);
    return {
      kcal: num("calories"),
      protein_g: num("protein (g)"),
      carb_g: num("total carbohydrates (g)"),
      fat_g: num("total fat (g)"),
    };
  }
  // fallback
  return { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
}

function normalizeMenu(menuData: any, wantedPeriodId?: string) {
  // The period endpoint sometimes returns:
  // A) menu.periods = [{ id, categories: [...] }, ...]
  // B) menu.periods = { id, categories: [...] }
  const periodsNode = menuData?.menu?.periods;
  let periodBlock: any | undefined;

  if (Array.isArray(periodsNode)) {
    periodBlock =
      periodsNode.find((p: any) => p?.id === wantedPeriodId) ??
      periodsNode[0];
  } else if (periodsNode && typeof periodsNode === "object") {
    periodBlock = periodsNode;
  }

  const categories: any[] = periodBlock?.categories ?? [];
  const items = categories.flatMap((cat: any) => {
    const catName = cat?.name ?? "Uncategorized";
    const catItems: any[] = cat?.items ?? [];
    return catItems.map((it) => {
      const { kcal, protein_g, carb_g, fat_g } = extractMacros(it);
      const serving =
        it.portion || it.servingSize || it.serving || it.portion_size || "1 serving";
      return {
        id: String(it.id ?? it.mrn ?? it.webtrition_id ?? it.name),
        name: String(it.name ?? "Item"),
        station: String(catName),
        serving_name: String(serving),
        per_serving_kcal: kcal,
        per_serving_protein_g: protein_g,
        per_serving_carb_g: carb_g,
        per_serving_fat_g: fat_g,
      };
    });
  });

  return items;
}

async function fetchItems(date: string, meal: string) {
  const base = `https://api.dineoncampus.com/v1/location/${LOCATION_ID}`;
  const periodsUrl = `${base}/periods?platform=2&date=${date}`;
  const periodsData = await getJSON(periodsUrl);

  const periods: any[] = periodsData?.periods ?? [];
  const target = periods.find(
    (p) => String(p?.name ?? "").toLowerCase() === meal.toLowerCase()
  );

  if (!target) {
    return { items: [], periods };
  }

  // Try platform=2 first
  const menuUrl2 = `${base}/periods/${target.id}?platform=2&date=${date}`;
  let menuData = await getJSON(menuUrl2);
  let items = normalizeMenu(menuData, target.id);

  // Fallback: platform=0 sometimes returns categories when 2 doesn't
  if (items.length === 0) {
    const menuUrl0 = `${base}/periods/${target.id}?platform=0&date=${date}`;
    try {
      menuData = await getJSON(menuUrl0);
      items = normalizeMenu(menuData, target.id);
    } catch {
      // ignore
    }
  }

  return { items, periods };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const meal = searchParams.get("meal");

    if (!date || !meal) {
      return NextResponse.json({ error: "Missing date or meal" }, { status: 400 });
    }

    const { items, periods } = await fetchItems(date, meal);

    return NextResponse.json(
      { date, meal, count: items.length, items, periods },
      { headers: { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
