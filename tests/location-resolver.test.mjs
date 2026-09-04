import assert from "node:assert/strict";
import test from "node:test";
import { locationMatchFor } from "../app/api/news/location-resolver.ts";

test("maps Hawaii and its islands to their actual Pacific coordinates", () => {
  const hawaii = locationMatchFor("Hawaii braces for heavy surf");
  const honolulu = locationMatchFor("Honolulu airport resumes operations");
  const maui = locationMatchFor("Maui residents prepare for high winds");

  assert.equal(hawaii?.name, "Hawaii");
  assert.ok(hawaii && hawaii.lng < -150);
  assert.equal(honolulu?.name, "Honolulu");
  assert.equal(maui?.name, "Maui");
});

test("does not mistake the ordinary word island for Iceland", () => {
  assert.equal(locationMatchFor("Storm approaches a remote Pacific island"), undefined);
  assert.equal(locationMatchFor("Island communities issue coastal warnings"), undefined);
});

test("still maps explicit Iceland references correctly", () => {
  const match = locationMatchFor("Iceland issues a new volcanic activity update");
  assert.equal(match?.name, "Iceland");
  assert.ok(match && match.lng > -30 && match.lng < 0);
});

test("requires complete word boundaries", () => {
  assert.equal(locationMatchFor("The Thailand election enters its final week")?.name, "Thailand");
  assert.notEqual(locationMatchFor("A new book explores Thai language")?.name, "Thailand");
});

test("avoids names that commonly refer to people, teams or companies", () => {
  assert.equal(locationMatchFor("Jordan scores 28 points in the season opener"), undefined);
  assert.equal(locationMatchFor("Georgia wins the college football final"), undefined);
  assert.equal(locationMatchFor("Chad Smith joins the festival lineup"), undefined);
  assert.equal(locationMatchFor("Paris Hilton attends the premiere"), undefined);
  assert.equal(locationMatchFor("Amazon reports quarterly earnings"), undefined);
});

test("accepts unambiguous forms of ambiguous country names", () => {
  assert.equal(locationMatchFor("Jordanian parliament approves the measure")?.name, "Jordan");
  assert.equal(locationMatchFor("Talks continue in Tbilisi")?.name, "Georgia");
  assert.equal(locationMatchFor("Chadian officials announce the result")?.name, "Chad");
});

test("maps Canadian national and city coverage accurately", () => {
  assert.equal(locationMatchFor("Canada announces a new federal budget")?.region, "Canada");
  assert.equal(locationMatchFor("Ottawa releases the federal budget")?.name, "Ottawa");
  assert.equal(locationMatchFor("Wildfire conditions worsen near Yellowknife")?.name, "Yellowknife");
  assert.equal(locationMatchFor("Port of Vancouver traffic resumes")?.name, "Vancouver");
  assert.equal(locationMatchFor("Regina King joins the cast"), undefined);
});

test("maps Colombo headlines to the Sri Lankan capital", () => {
  const match = locationMatchFor("Colombo port operations return to normal");
  assert.equal(match?.name, "Colombo");
  assert.equal(match?.region, "South Asia");
  assert.equal(match?.precision, "hotspot");
  assert.ok(match && match.lat > 6 && match.lat < 8);
  assert.ok(match && match.lng > 79 && match.lng < 81);
});
