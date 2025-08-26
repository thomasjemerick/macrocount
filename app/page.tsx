"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ChevronsUpDown, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ChartTooltip } from "@/components/ui/chart";

type Item = {
  id: string;
  name: string;
  station?: string;
  meal_period?: string;
  serving_name?: string;
  per_serving_kcal: number;
  per_serving_protein_g: number;
  per_serving_carb_g: number;
  per_serving_fat_g: number;
  protein_density?: number; // protein calories per 100 kcal (higher = better protein density)
  fat_efficiency?: number;  // fat calories per 100 kcal (lower = leaner)
};

// ----- local helpers (avoid UTC “yesterday” bug) -----
function localYMD(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function defaultMealByTime() {
  const h = new Date().getHours();
  if (h < 10) return "Breakfast";
  if (h < 15) return "Lunch";
  return "Dinner";
}
// ------------------------------------------------------

// small classnames helper for the combobox check icon
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ComparePickerProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  exclude?: string; // hide this option (to prevent selecting the same on both sides)
};

function ComparePicker({
  label,
  placeholder = "Search items…",
  value,
  onChange,
  options,
  exclude,
}: ComparePickerProps) {
  const [open, setOpen] = useState(false);

  const visible = useMemo(
    () => options.filter((n) => !exclude || n !== exclude).sort((a, b) => a.localeCompare(b)),
    [options, exclude]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[260px] justify-between">
          {value || (label ? `Select ${label}` : "Select item")}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0">
        <Command shouldFilter>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {visible.map((name) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={(v) => {
                    onChange(v);
                    setOpen(false);
                  }}
                >
                  <Check className={cx("mr-2 h-4 w-4", value === name ? "opacity-100" : "opacity-0")} />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function DiningHallMacros() {
  // initialize AFTER mount to avoid SSR/CSR mismatch
  const [date, setDate] = useState<string>("");
  const [meal, setMeal] = useState<string>("");
  const [station, setStation] = useState<string>("All stations");

  // data
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ui state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [servingSizes, setServingSizes] = useState<Record<string, number>>({});
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [proteinMetric, setProteinMetric] = useState<"perServing" | "per100kcal">("perServing");

  // set defaults on client
  useEffect(() => {
    if (!date) setDate(localYMD());
    if (!meal) setMeal(defaultMealByTime());
  }, [date, meal]);

  // fetch when both date & meal are ready
  useEffect(() => {
    if (!date || !meal) return;

    let timer: any;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ date, meal });
        const res = await fetch(`/api/menu?${params.toString()}`);
        const data = await res.json();
        setItems(data.items || []);
        setSelectedFoods((prev) => prev.filter((n) => (data.items || []).some((i: Item) => i.name === n)));
        const names = new Set((data.items || []).map((i: Item) => i.name));
        if (compareA && !names.has(compareA)) setCompareA("");
        if (compareB && !names.has(compareB)) setCompareB("");
      } catch {
        setError("Failed to load menu");
      } finally {
        setLoading(false);
      }
    };
    load();
    timer = setInterval(load, 5 * 60 * 1000); // refresh every 5m
    return () => clearInterval(timer);
  }, [date, meal]);

  // lookups
  const byName = useMemo(() => {
    const m = new Map<string, Item[]>();
    items.forEach((i) => {
      const arr = m.get(i.name) || [];
      arr.push(i);
      m.set(i.name, arr);
    });
    return m;
  }, [items]);

  const stations = useMemo(
    () => ["All stations", ...Array.from(new Set(items.map((i) => i.station ?? "Uncategorized"))).sort()],
    [items]
  );

  const getItem = (name: string): Item | undefined => {
    const candidates = byName.get(name) ?? [];
    if (station !== "All stations") {
      const hit = candidates.find((c) => (c.station ?? "Uncategorized") === station);
      if (hit) return hit;
    }
    return candidates[0];
  };

  // left list filter
  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return items.filter((i) => {
      const stationOk = station === "All stations" || (i.station ?? "Uncategorized") === station;
      const textOk = i.name.toLowerCase().includes(q) || (i.station ?? "").toLowerCase().includes(q);
      return stationOk && textOk;
    });
  }, [items, searchTerm, station]);

  const filteredFoods = useMemo(
    () => Array.from(new Set(filteredItems.map((i) => i.name))),
    [filteredItems]
  );

  const handleFoodToggle = (food: string, checked: boolean) => {
    if (checked) {
      setSelectedFoods((prev) => (prev.includes(food) ? prev : [...prev, food]));
      setServingSizes((s) => ({ ...s, [food]: s[food] ?? 1 }));
    } else {
      setSelectedFoods((prev) => prev.filter((f) => f !== food));
      setServingSizes(({ [food]: _omit, ...rest }) => rest);
    }
  };

  const handleServingChange = (food: string, serving: number) => {
    const clean = Number.isFinite(serving) ? Math.max(0, serving) : 0;
    setServingSizes((s) => ({ ...s, [food]: clean }));
  };

  // totals
  const totals = selectedFoods.reduce(
    (acc, food) => {
      const qty = servingSizes[food] ?? 1;
      const it = getItem(food);
      if (!it) return acc;
      return {
        calories: acc.calories + it.per_serving_kcal * qty,
        protein: acc.protein + it.per_serving_protein_g * qty,
        carbs: acc.carbs + it.per_serving_carb_g * qty,
        fat: acc.fat + it.per_serving_fat_g * qty,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  type PieDatum = { name: string; value: number; color: string };
  const pieData: PieDatum[] = [
    { name: "Protein", value: totals.protein, color: "#3b82f6" },
    { name: "Carbs", value: totals.carbs, color: "#facc15" },
    { name: "Fat", value: totals.fat, color: "#ef4444" },
  ];

  // compare
  const A = compareA ? getItem(compareA) : undefined;
  const B = compareB ? getItem(compareB) : undefined;

  // top protein
  const rankedProtein = useMemo(() => {
    const pool =
      station === "All stations"
        ? items
        : items.filter((i) => (i.station ?? "Uncategorized") === station);

    const rows = pool.map((i) => {
      const kcal = i.per_serving_kcal || 0;
      const g = i.per_serving_protein_g || 0;

      // grams per 100 kcal (what the UI shows)
      const gramsPer100kcal = kcal > 0 ? (g / kcal) * 100 : 0;
      const pctProteinCalories = kcal > 0 ? (g * 4 / kcal) * 100 : 0;

      return { item: i, perServing: g, gramsPer100kcal, pctProteinCalories };
    });

    // simple gating to avoid “spinach wins”
    const MIN_PROTEIN_G = proteinMetric === "perServing" ? 10 : 8;
    const MIN_KCAL = 60;

    const filtered = rows.filter(
      (r) => r.item.per_serving_kcal >= MIN_KCAL && r.perServing >= MIN_PROTEIN_G
    );

    const key = proteinMetric === "perServing" ? "perServing" : "gramsPer100kcal";
    const sorted = filtered.sort((a, b) => (b as any)[key] - (a as any)[key]);
    return sorted.slice(0, 5);
  }, [items, station, proteinMetric]);

  const allNames = useMemo(
    () => Array.from(new Set(items.map((i) => i.name))).sort(),
    [items]
  );

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">Loading menu…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">MacroCount — 459 Macronutrient Calculator</h1>

        {/* top controls */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Input
            type="date"
            value={date || ""}
            onChange={(e) => setDate(e.target.value)}
            className="w-[180px]"
          />
          <Select value={meal || ""} onValueChange={setMeal}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Meal" />
            </SelectTrigger>
            <SelectContent>
              {["Breakfast", "Brunch", "Lunch", "Dinner", "Everyday", "Late Night"].map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={station} onValueChange={setStation}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Station" />
            </SelectTrigger>
            <SelectContent>
              {stations.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground self-center">
            {items.length} items
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* left: list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Menu · MacroCount</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search menu"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2">
                {filteredFoods.map((food) => {
                  const sample = getItem(food);
                  const checked = selectedFoods.includes(food);
                  return (
                    <label
                      key={food}
                      className={`flex items-start gap-3 rounded-md border p-3 transition hover:bg-accent hover:text-accent-foreground ${
                        checked ? "border-primary/50 bg-primary/5" : "border-border"
                      }`}
                    >
                      <Checkbox
                        id={food}
                        checked={checked}
                        onCheckedChange={(c) => handleFoodToggle(food, Boolean(c))}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-medium leading-tight">{food}</div>
                        <div className="text-xs text-muted-foreground">
                          {(sample?.station || "—") + " · " + (sample?.serving_name || "")}
                        </div>
                      </div>
                      {sample?.protein_density !== undefined && sample.protein_density >= 20 && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          High Protein
                        </span>
                      )}
                      {sample?.fat_efficiency !== undefined && sample.fat_efficiency <= 25 && (
                        <span className="ml-1 text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">
                          Low Fat
                        </span>
                      )}
                    </label>
                  );
                })}
                {filteredFoods.length === 0 && (
                  <div className="text-sm text-muted-foreground">No results for “{searchTerm}”.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* middle: selections */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Selected Items</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-4">
              <div className="space-y-6">
                {selectedFoods.map((food) => {
                  const it = getItem(food);
                  const servings = servingSizes[food] ?? 1;
                  return (
                    <div key={food} className="border-b pb-4 last:border-b-0 last:pb-0">
                      <div className="flex items-baseline justify-between">
                        <h3 className="font-semibold text-lg">{food}</h3>
                        <span className="text-xs text-muted-foreground">{it?.serving_name || ""}</span>
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        <Select value="serving" disabled>
                          <SelectTrigger className="w-28">
                            <SelectValue placeholder="serving" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="serving">serving</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          value={servings}
                          onChange={(e) => handleServingChange(food, parseFloat(e.target.value))}
                          className="w-28"
                        />
                        <span className="text-sm text-muted-foreground">servings</span>
                      </div>

                      {it && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Per serving: {it.per_serving_kcal} kcal · {it.per_serving_protein_g}P /{" "}
                          {it.per_serving_carb_g}C / {it.per_serving_fat_g}F
                        </div>
                      )}
                    </div>
                  );
                })}
                {selectedFoods.length === 0 && (
                  <div className="text-sm text-muted-foreground">Pick items on the left.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* right: totals + pie + top5 */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Calories</span>
                  <span className="text-2xl font-bold">{Math.round(totals.calories)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg">Protein (g)</span>
                  <span className="text-2xl font-bold">{totals.protein.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg">Carbs (g)</span>
                  <span className="text-2xl font-bold">{totals.carbs.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg">Fat (g)</span>
                  <span className="text-2xl font-bold">{totals.fat.toFixed(1)}</span>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3 text-center">Macronutrient Distribution</h4>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={20}
                          dataKey="value"
                          label={({ name, value }: { name: string; value: number }) =>
                            `${name}: ${value.toFixed(1)}g`
                          }
                          labelLine={false}
                        >
                          {pieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload as { name: string; value: number };
                              return (
                                <div className="bg-background border rounded-lg p-2 shadow-md">
                                  <p className="font-medium">
                                    {data.name}: {data.value.toFixed(1)}g
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top 5 Protein */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle>Top 5 Protein Options</CardTitle>
                <Select value={proteinMetric} onValueChange={(v: "perServing" | "per100kcal") => setProteinMetric(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Metric" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perServing">Protein per serving (g)</SelectItem>
                    <SelectItem value="per100kcal">Protein per 100 kcal</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="pt-0">
                <ol className="space-y-2">
                  {rankedProtein.map(({ item, perServing, gramsPer100kcal }, idx) => (
                    <li key={item.id} className="flex items-baseline justify-between border-b pb-2 last:border-b-0">
                      <div className="flex-1 pr-3">
                        <span className="mr-2 text-sm text-muted-foreground">{idx + 1}.</span>
                        <span className="font-medium">{item.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">· {item.station || "—"}</span>
                        <div className="text-xs text-muted-foreground">
                          {item.per_serving_kcal} kcal · {item.per_serving_protein_g}P / {item.per_serving_carb_g}C / {item.per_serving_fat_g}F
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold">
                        {proteinMetric === "perServing"
                          ? `${perServing.toFixed(1)} g`
                          : `${gramsPer100kcal.toFixed(1)} g per 100 kcal`}
                      </div>
                    </li>
                  ))}
                  {rankedProtein.length === 0 && (
                    <div className="text-sm text-muted-foreground">No qualifying items.</div>
                  )}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Compare */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Compare Two Items</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <div className="flex flex-wrap gap-3 mb-4">
              <ComparePicker
                label="item A"
                placeholder="Search item A…"
                value={compareA}
                onChange={setCompareA}
                options={allNames}
                exclude={compareB}
              />
              <ComparePicker
                label="item B"
                placeholder="Search item B…"
                value={compareB}
                onChange={setCompareB}
                options={allNames}
                exclude={compareA}
              />
            </div>

            {A && B ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2"></th>
                      <th className="text-left py-2 px-2">
                        {A.name} <span className="text-xs text-muted-foreground">· {A.station || "—"}</span>
                      </th>
                      <th className="text-left py-2 px-2">
                        {B.name} <span className="text-xs text-muted-foreground">· {B.station || "—"}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Serving", A.serving_name || "serving", B.serving_name || "serving"],
                      ["Calories", `${A.per_serving_kcal}`, `${B.per_serving_kcal}`],
                      ["Protein (g)", `${A.per_serving_protein_g}`, `${B.per_serving_protein_g}`],
                      ["Carbs (g)", `${A.per_serving_carb_g}`, `${B.per_serving_carb_g}`],
                      ["Fat (g)", `${A.per_serving_fat_g}`, `${B.per_serving_fat_g}`],
                    ].map(([label, a, b]) => (
                      <tr key={label} className="border-b">
                        <td className="py-2 px-2">{label}</td>
                        <td className={`py-2 px-2 ${Number(a) > Number(b) && label === "Protein (g)" ? "font-semibold text-green-600" : ""} ${Number(a) < Number(b) && label !== "Protein (g)" && label !== "Serving" ? "text-green-600" : ""}`}>
                          {a}
                        </td>
                        <td className={`py-2 px-2 ${Number(b) > Number(a) && label === "Protein (g)" ? "font-semibold text-green-600" : ""} ${Number(b) < Number(a) && label !== "Protein (g)" && label !== "Serving" ? "text-green-600" : ""}`}>
                          {b}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Choose two items to compare.</div>
            )}
          </CardContent>
        </Card>

        {/* Detail table */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Food</th>
                    <th className="text-left py-3 px-4 font-semibold">Serving</th>
                    <th className="text-right py-3 px-4 font-semibold">Calories</th>
                    <th className="text-right py-3 px-4 font-semibold">Protein (g)</th>
                    <th className="text-right py-3 px-4 font-semibold">Carbs (g)</th>
                    <th className="text-right py-3 px-4 font-semibold">Fat (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFoods.map((food) => {
                    const qty = servingSizes[food] ?? 1;
                    const it = getItem(food);
                    if (!it) return null;
                    return (
                      <tr key={food} className="border-b">
                        <td className="py-3 px-4">{food}</td>
                        <td className="py-3 px-4 text-left text-sm text-muted-foreground">
                          {qty} × {it.serving_name || "serving"}
                        </td>
                        <td className="text-right py-3 px-4">{Math.round(it.per_serving_kcal * qty)}</td>
                        <td className="text-right py-3 px-4">{(it.per_serving_protein_g * qty).toFixed(1)}</td>
                        <td className="text-right py-3 px-4">{(it.per_serving_carb_g * qty).toFixed(1)}</td>
                        <td className="text-right py-3 px-4">{(it.per_serving_fat_g * qty).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
