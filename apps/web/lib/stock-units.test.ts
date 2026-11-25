import assert from "node:assert/strict";
import test from "node:test";
import {
  getConversionFactor,
  getUnitOptions,
  toBaseQuantity,
  getDefaultUnitAndQty,
} from "./stock-units.ts";

test("getUnitOptions returns appropriate unit choices per base unit", () => {
  const kgOpts = getUnitOptions("KG").map((u) => u.value);
  assert.ok(kgOpts.includes("g"));
  assert.ok(kgOpts.includes("kg"));
  assert.ok(kgOpts.includes("tsp"));
  assert.ok(kgOpts.includes("tbsp"));

  const literOpts = getUnitOptions("L").map((u) => u.value);
  assert.ok(literOpts.includes("ml"));
  assert.ok(literOpts.includes("l"));

  const pieceOpts = getUnitOptions("PIECE").map((u) => u.value);
  assert.ok(pieceOpts.includes("piece"));
  assert.ok(pieceOpts.includes("dozen"));
});

test("toBaseQuantity converts weight correctly", () => {
  // 250 grams to KG base
  assert.equal(toBaseQuantity(250, "g", "KG"), 0.25);
  // 1 kg to KG base
  assert.equal(toBaseQuantity(1, "kg", "KG"), 1);
  // 3 teaspoons (5g each) to G base = 15g
  assert.equal(toBaseQuantity(3, "tsp", "G"), 15);
  // 3 teaspoons (5g each) to KG base = 0.015 kg
  assert.equal(toBaseQuantity(3, "tsp", "KG"), 0.015);
  // 2 tablespoons (15g each) to G base = 30g
  assert.equal(toBaseQuantity(2, "tbsp", "G"), 30);
});

test("toBaseQuantity converts volume and count correctly", () => {
  // 200 ml to L base
  assert.equal(toBaseQuantity(200, "ml", "L"), 0.2);
  // 2 pieces to PIECE base
  assert.equal(toBaseQuantity(2, "piece", "PIECE"), 2);
  // 1 dozen to PIECE base = 12
  assert.equal(toBaseQuantity(1, "dozen", "PIECE"), 12);
});

test("getDefaultUnitAndQty formats sub-unit quantities naturally", () => {
  // 0.25 kg defaults to 250 g
  assert.deepEqual(getDefaultUnitAndQty(0.25, "KG"), { unit: "g", qty: "250" });
  // 1.5 kg stays kg
  assert.deepEqual(getDefaultUnitAndQty(1.5, "KG"), { unit: "kg", qty: "1.5" });
  // 0.2 l defaults to 200 ml
  assert.deepEqual(getDefaultUnitAndQty(0.2, "L"), { unit: "ml", qty: "200" });
  // 2 piece stays piece
  assert.deepEqual(getDefaultUnitAndQty(2, "PIECE"), { unit: "piece", qty: "2" });
});
