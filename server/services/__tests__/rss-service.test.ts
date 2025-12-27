import assert from "assert";
import crypto from "crypto";

function normalizeLink(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "at_medium", "at_campaign", "at_custom1", "at_custom2", "at_custom3", "at_custom4",
      "ns_mchannel", "ns_source", "ns_campaign", "ns_linkname", "ns_fee",
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    return parsed.toString();
  } catch {
    return url;
  }
}

function generateContentHash(url: string, title: string, guid?: string): string {
  const content = guid
    ? `guid:${guid}`
    : `${url}|${title}`.toLowerCase().trim();
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 32);
}

function generateGuidNormalized(guid: string | undefined, link: string, title: string, pubDate?: string): string {
  if (guid) {
    return crypto.createHash("sha256").update(`guid:${guid}`).digest("hex").substring(0, 32);
  }
  const fallback = `${link}|${title}|${pubDate || ""}`.toLowerCase().trim();
  return crypto.createHash("sha256").update(fallback).digest("hex").substring(0, 32);
}

function isValidXML(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.includes("<rss") || trimmed.includes("<feed") || trimmed.includes("<RDF");
}

function parsePublishedAt(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err.message}`);
    failed++;
  }
}

console.log("\nTesting normalizeLink:");
test("removes UTM parameters", () => {
  const url = "https://example.com/article?utm_source=twitter&utm_medium=social&id=123";
  assert.strictEqual(normalizeLink(url), "https://example.com/article?id=123");
});

test("removes BBC at_* parameters", () => {
  const url = "https://bbc.com/news/article?at_medium=custom7&at_custom1=link";
  assert.strictEqual(normalizeLink(url), "https://bbc.com/news/article");
});

test("removes ns_* parameters", () => {
  const url = "https://example.com/page?ns_mchannel=social&ns_source=fb&keep=true";
  assert.strictEqual(normalizeLink(url), "https://example.com/page?keep=true");
});

test("preserves non-tracking parameters", () => {
  const url = "https://example.com/search?q=hello&page=2";
  assert.strictEqual(normalizeLink(url), "https://example.com/search?q=hello&page=2");
});

test("handles invalid URLs gracefully", () => {
  const url = "not-a-valid-url";
  assert.strictEqual(normalizeLink(url), "not-a-valid-url");
});

console.log("\nTesting generateContentHash:");
test("uses guid when available", () => {
  const hash1 = generateContentHash("https://example.com/a", "Title A", "unique-guid-123");
  const hash2 = generateContentHash("https://example.com/b", "Title B", "unique-guid-123");
  assert.strictEqual(hash1, hash2);
});

test("uses url+title when no guid", () => {
  const hash1 = generateContentHash("https://example.com/article", "My Article");
  const hash2 = generateContentHash("https://example.com/article", "My Article");
  assert.strictEqual(hash1, hash2);
});

test("different content produces different hashes", () => {
  const hash1 = generateContentHash("https://example.com/a", "Title A");
  const hash2 = generateContentHash("https://example.com/b", "Title B");
  assert.notStrictEqual(hash1, hash2);
});

test("hash is 32 characters", () => {
  const hash = generateContentHash("https://example.com", "Test");
  assert.strictEqual(hash.length, 32);
});

console.log("\nTesting generateGuidNormalized:");
test("uses guid when present", () => {
  const hash = generateGuidNormalized("my-guid", "https://example.com", "Title", "2024-01-01");
  assert.strictEqual(hash.length, 32);
});

test("uses link+title+pubDate fallback when no guid", () => {
  const hash1 = generateGuidNormalized(undefined, "https://example.com/a", "Title", "2024-01-01");
  const hash2 = generateGuidNormalized(undefined, "https://example.com/a", "Title", "2024-01-01");
  assert.strictEqual(hash1, hash2);
});

test("different pubDate produces different hash when no guid", () => {
  const hash1 = generateGuidNormalized(undefined, "https://example.com", "Title", "2024-01-01");
  const hash2 = generateGuidNormalized(undefined, "https://example.com", "Title", "2024-01-02");
  assert.notStrictEqual(hash1, hash2);
});

test("handles empty pubDate", () => {
  const hash = generateGuidNormalized(undefined, "https://example.com", "Title");
  assert.strictEqual(hash.length, 32);
});

console.log("\nTesting isValidXML:");
test("accepts RSS 2.0 feed", () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>`;
  assert.strictEqual(isValidXML(xml), true);
});

test("accepts Atom feed", () => {
  const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>`;
  assert.strictEqual(isValidXML(xml), true);
});

test("accepts RSS 1.0/RDF feed", () => {
  const xml = `<?xml version="1.0"?><RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><title>Test</title></channel></RDF>`;
  assert.strictEqual(isValidXML(xml), true);
});

test("rejects HTML response", () => {
  const html = `<!DOCTYPE html><html><head><title>Page Not Found</title></head><body></body></html>`;
  assert.strictEqual(isValidXML(html), false);
});

test("rejects plain text", () => {
  const text = `This is just some plain text content`;
  assert.strictEqual(isValidXML(text), false);
});

test("rejects JSON response", () => {
  const json = `{"error": "not found", "status": 404}`;
  assert.strictEqual(isValidXML(json), false);
});

test("handles whitespace before XML declaration", () => {
  const xml = `   
    <?xml version="1.0"?>
    <rss version="2.0"><channel><title>Test</title></channel></rss>`;
  assert.strictEqual(isValidXML(xml), true);
});

console.log("\nTesting parsePublishedAt:");
test("parses ISO 8601 date", () => {
  const date = parsePublishedAt("2024-12-27T10:30:00Z");
  assert.ok(date instanceof Date);
  assert.strictEqual(date?.toISOString(), "2024-12-27T10:30:00.000Z");
});

test("parses RFC 2822 date (common in RSS)", () => {
  const date = parsePublishedAt("Fri, 27 Dec 2024 10:30:00 GMT");
  assert.ok(date instanceof Date);
});

test("handles timezone offsets", () => {
  const date = parsePublishedAt("2024-12-27T10:30:00+05:00");
  assert.ok(date instanceof Date);
  assert.strictEqual(date?.toISOString(), "2024-12-27T05:30:00.000Z");
});

test("returns null for undefined", () => {
  assert.strictEqual(parsePublishedAt(undefined), null);
});

test("returns null for invalid date", () => {
  assert.strictEqual(parsePublishedAt("not-a-date"), null);
});

console.log("\nTesting Deduplication:");
test("same guid produces same hash regardless of other fields", () => {
  const hash1 = generateGuidNormalized("article-123", "https://site.com/old", "Old Title", "2024-01-01");
  const hash2 = generateGuidNormalized("article-123", "https://site.com/new", "New Title", "2024-01-02");
  assert.strictEqual(hash1, hash2);
});

test("missing guid falls back to composite key", () => {
  const hash1 = generateGuidNormalized(undefined, "https://example.com/a", "Title", "2024-01-01");
  const hash2 = generateGuidNormalized(undefined, "https://example.com/a", "Title", "2024-01-01");
  const hash3 = generateGuidNormalized(undefined, "https://example.com/different", "Title", "2024-01-01");
  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, hash3);
});

console.log("\nTesting Sample XML Feeds:");
const sampleRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <link>https://example.com</link>
    <item>
      <title>Article One</title>
      <link>https://example.com/article-1</link>
      <guid>https://example.com/article-1</guid>
    </item>
  </channel>
</rss>`;

const sampleAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sample Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <id>https://example.com/entry-1</id>
  </entry>
</feed>`;

test("validates sample RSS feed", () => {
  assert.strictEqual(isValidXML(sampleRSS), true);
});

test("validates sample Atom feed", () => {
  assert.strictEqual(isValidXML(sampleAtom), true);
});

test("rejects 404 HTML page", () => {
  const html = `<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Page Not Found</h1></body></html>`;
  assert.strictEqual(isValidXML(html), false);
});

console.log(`\n========== Results: ${passed} passed, ${failed} failed ==========`);
process.exit(failed > 0 ? 1 : 0);
