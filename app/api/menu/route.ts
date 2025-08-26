import { NextResponse } from "next/server";
import { normalizePeriodsPayload } from "@/lib/dine";

const BASE = "https://api.dineoncampus.com/v1";
const LOCATION = process.env.DINE_LOCATION_ID ?? "66c79443351d5300dddee979";

function localYMD(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getJSON(url: string) {
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? localYMD();
  const mealRaw = (searchParams.get("meal") ?? "").toLowerCase();

  const listUrl = `${BASE}/location/${LOCATION}/periods?platform=2&date=${date}`;
  const list = await getJSON(listUrl);
  const periodsArr: any[] = Array.isArray(list?.periods) ? list.periods : [];

  let periodId: string | undefined;
  if (mealRaw) {
    const hit = periodsArr.find((p) => String(p?.name ?? "").toLowerCase() === mealRaw);
    periodId = hit?.id;
  }

  let raw: any;
  if (periodId) {
    const dUrl = `${BASE}/location/${LOCATION}/periods/${periodId}?platform=2&date=${date}`;
    try {
      raw = await getJSON(dUrl);
    } catch {
      raw = { menu: { periods: [] } };
    }
  } else {
    const firstId = periodsArr[0]?.id;
    if (firstId) {
      const dUrl = `${BASE}/location/${LOCATION}/periods/${firstId}?platform=2&date=${date}`;
      try {
        raw = await getJSON(dUrl);
      } catch {
        raw = { menu: { periods: [] } };
      }
    } else {
      raw = { menu: { periods: [] } };
    }
  }

  const items = normalizePeriodsPayload(raw);
  return NextResponse.json({
    date,
    meal: mealRaw || null,
    count: items.length,
    items,
    periods: periodsArr,
  });
}
