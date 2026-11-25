export interface UnitOption {
  value: string;
  label: string;
}

export function getUnitOptions(baseUnit?: string): UnitOption[] {
  const bu = baseUnit?.toUpperCase();
  if (bu === "KG" || bu === "G") {
    return [
      { value: "g", label: "g (Gram)" },
      { value: "kg", label: "kg (Kilogram)" },
      { value: "tsp", label: "tsp (5g)" },
      { value: "tbsp", label: "tbsp (15g)" },
      { value: "cup", label: "cup (200g)" },
      { value: "pinch", label: "pinch (0.5g)" },
      { value: "mg", label: "mg" },
    ];
  }
  if (bu === "L" || bu === "ML") {
    return [
      { value: "ml", label: "ml (Milliliter)" },
      { value: "l", label: "l (Liter)" },
      { value: "tsp", label: "tsp (5ml)" },
      { value: "tbsp", label: "tbsp (15ml)" },
      { value: "cup", label: "cup (240ml)" },
    ];
  }
  if (bu === "PIECE" || bu === "DOZEN") {
    return [
      { value: "piece", label: "piece (pc)" },
      { value: "dozen", label: "dozen (12 pcs)" },
    ];
  }
  if (bu === "PACK") {
    return [
      { value: "pack", label: "pack" },
      { value: "piece", label: "piece (pc)" },
    ];
  }
  if (bu === "BOX") {
    return [
      { value: "box", label: "box" },
      { value: "piece", label: "piece (pc)" },
    ];
  }
  return [
    { value: "g", label: "g (Gram)" },
    { value: "kg", label: "kg (Kilogram)" },
    { value: "piece", label: "piece (pc)" },
    { value: "ml", label: "ml (Milliliter)" },
    { value: "l", label: "l (Liter)" },
    { value: "tsp", label: "tsp (5g/5ml)" },
    { value: "tbsp", label: "tbsp (15g/15ml)" },
    { value: "pack", label: "pack" },
    { value: "box", label: "box" },
  ];
}

export function getConversionFactor(unit: string, baseUnit?: string): number {
  const bu = baseUnit?.toUpperCase() ?? "G";
  const u = unit.toLowerCase();

  if (u === bu.toLowerCase()) return 1;

  if (bu === "KG") {
    if (u === "kg") return 1;
    if (u === "g") return 0.001;
    if (u === "mg") return 0.000001;
    if (u === "tsp") return 0.005;
    if (u === "tbsp") return 0.015;
    if (u === "cup") return 0.2;
    if (u === "pinch") return 0.0005;
  } else if (bu === "G") {
    if (u === "g") return 1;
    if (u === "kg") return 1000;
    if (u === "mg") return 0.001;
    if (u === "tsp") return 5;
    if (u === "tbsp") return 15;
    if (u === "cup") return 200;
    if (u === "pinch") return 0.5;
  } else if (bu === "L") {
    if (u === "l") return 1;
    if (u === "ml") return 0.001;
    if (u === "tsp") return 0.005;
    if (u === "tbsp") return 0.015;
    if (u === "cup") return 0.24;
  } else if (bu === "ML") {
    if (u === "ml") return 1;
    if (u === "l") return 1000;
    if (u === "tsp") return 5;
    if (u === "tbsp") return 15;
    if (u === "cup") return 240;
  } else if (bu === "PIECE") {
    if (u === "piece") return 1;
    if (u === "dozen") return 12;
  } else if (bu === "DOZEN") {
    if (u === "dozen") return 1;
    if (u === "piece") return 1 / 12;
  }

  return 1;
}

export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function toBaseQuantity(qty: number, unit: string, baseUnit?: string): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const factor = getConversionFactor(unit, baseUnit);
  return round3(qty * factor);
}

export function getDefaultUnitAndQty(rawBaseQty: number, baseUnit?: string): { unit: string; qty: string } {
  const bu = baseUnit?.toUpperCase();
  if (bu === "KG" && rawBaseQty > 0 && rawBaseQty < 1) {
    return { unit: "g", qty: String(round3(rawBaseQty * 1000)) };
  }
  if (bu === "L" && rawBaseQty > 0 && rawBaseQty < 1) {
    return { unit: "ml", qty: String(round3(rawBaseQty * 1000)) };
  }
  if (bu === "KG") return { unit: "kg", qty: String(rawBaseQty) };
  if (bu === "G") return { unit: "g", qty: String(rawBaseQty) };
  if (bu === "L") return { unit: "l", qty: String(rawBaseQty) };
  if (bu === "ML") return { unit: "ml", qty: String(rawBaseQty) };
  if (bu === "PIECE") return { unit: "piece", qty: String(rawBaseQty) };
  if (bu === "DOZEN") return { unit: "dozen", qty: String(rawBaseQty) };
  return { unit: baseUnit?.toLowerCase() ?? "g", qty: String(rawBaseQty) };
}

