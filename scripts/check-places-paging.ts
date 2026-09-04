import { pagedBody, searchBody } from "./discover-google-places";

/**
 * A Places Text Search paging request must repeat the whole original search
 * and add pageToken. Sending the token alone is rejected with "Request
 * parameters for paging requests must match the initial SearchText request".
 *
 * That mistake is nastier than a normal bug because it does not look like one.
 * The rejection is per page, not per search, so page one still returns its 20
 * results and the run prints "20 result(s)" for a city — a tidy, plausible
 * number that happens to be the page size. Both the Ontario and the Texas
 * discovery passes ran this way: every dense metro capped at exactly 20,
 * truncated hardest precisely where the coverage gap was worst. Texas showed
 * "20 result(s)" for Houston, Dallas, Austin and San Antonio alike.
 *
 * Cheap to assert, and worth asserting, because nothing else would catch it.
 */
let failed = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok && detail) console.log(`    ${detail}`);
};

const LAT = 29.7604;
const LNG = -95.3698;

const first = pagedBody(LAT, LNG);
const next = pagedBody(LAT, LNG, "TOKEN123");

check("page 1 carries the query", first.textQuery === "mosque", JSON.stringify(first));
check("page 1 carries no token", first.pageToken === undefined);

check("a paging request still carries the query", next.textQuery === "mosque", JSON.stringify(next));
check("a paging request still carries the location", next.locationBias !== undefined);
check("a paging request still carries the page size", next.pageSize === 20);
check("a paging request carries the token", next.pageToken === "TOKEN123");

// The exact regression: a body that is only a token.
check(
  "a paging request is never just the token",
  Object.keys(next).length > 1,
  `got only: ${Object.keys(next).join(", ")}`,
);

// Page 2 must differ from page 1 by exactly the token, nothing else.
const base = searchBody(LAT, LNG);
const drifted = Object.keys(base).filter(
  (k) => JSON.stringify((next as any)[k]) !== JSON.stringify((base as any)[k]),
);
check(
  "paging changes nothing except adding the token",
  drifted.length === 0,
  `these differ: ${drifted.join(", ")}`,
);

console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
