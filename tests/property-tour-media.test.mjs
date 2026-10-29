import test from "node:test";
import assert from "node:assert/strict";
import { propertyForTour } from "../src/modules/virtual-tours/lib/property-media.ts";
const a = {
  id: "a",
  title: "A",
  image_url: "https://images.example/a.jpg",
  tour_url: "https://tnp-app-alpha.vercel.app/tours/one",
};
test("primary image stays linked to its actual tour across local and hosted origins", () => {
  assert.equal(propertyForTour([a], "one")?.image_url, a.image_url);
  assert.equal(
    propertyForTour(
      [{ ...a, tour_url: "http://localhost:3000/tours/one" }],
      "one",
    )?.id,
    "a",
  );
  assert.equal(propertyForTour([a], "different"), null);
});
test("selected property cannot display a different listing photo", () => {
  const b = { ...a, id: "b", image_url: "https://images.example/b.jpg" };
  assert.equal(propertyForTour([a, b], "one", "b")?.image_url, b.image_url);
  assert.equal(propertyForTour([a], "one", "b"), null);
  assert.equal(propertyForTour([a, b], "different", "b"), null);
});
