/**
 * Test: Sanitizer Artifact Removal
 * 
 * Verifies that sanitizeForWordPress() removes ALL LLM artifacts from final HTML output
 */

import { contentSanitizer } from "./server/services/content-sanitizer";

console.log("\n" + "=".repeat(80));
console.log("TEST: Sanitizer Artifact Removal (STRICT HTML CHECK)");
console.log("=".repeat(80) + "\n");

// Dirty sample with ALL artifacts
const dirtySampleTitle = "Real Estate Market Grows in Dubai – Arab News - Seo Blog";
const dirtySampleBody = `## Dubai Real Estate Market Shows Strong Growth

The real estate sector in Dubai continues to show robust growth in 2026.

**Meta Description:**
Dubai's property market reaches new heights with record sales and investor confidence.

Property values have increased by 15% year-over-year, according to recent data.

**Relevant Keywords:**
* dubai real estate
* property investment
* gcc real estate market
* dubai property prices
* waterfront real estate
* luxury properties dubai

—————

The market outlook remains positive for the coming quarters.

### Key Findings

Investment from international buyers has surged significantly.`;

console.log("BEFORE SANITIZATION:");
console.log("-".repeat(80));
console.log(`Title: ${dirtySampleTitle}`);
console.log(`Body length: ${dirtySampleBody.length} chars`);
console.log(`\nArtifacts present:`);
console.log(`  - "SEO Blog" in title: ${dirtySampleTitle.toLowerCase().includes("seo blog") ? "❌ YES" : "✅ NO"}`);
console.log(`  - "Meta Description" in body: ${dirtySampleBody.includes("Meta Description") ? "❌ YES" : "✅ NO"}`);
console.log(`  - "Relevant Keywords" in body: ${dirtySampleBody.includes("Relevant Keywords") ? "❌ YES" : "✅ NO"}`);
console.log(`  - Markdown headers (##): ${dirtySampleBody.includes("##") ? "❌ YES" : "✅ NO"}`);
console.log(`  - Horizontal rules (—————): ${dirtySampleBody.includes("—————") ? "❌ YES" : "✅ NO"}`);

// Run sanitizer
const sanitized = contentSanitizer.sanitizeForWordPress({
  title: dirtySampleTitle,
  body: dirtySampleBody,
});

console.log("\n" + "=".repeat(80));
console.log("AFTER SANITIZATION:");
console.log("-".repeat(80));
console.log(`Title: ${sanitized.title}`);
console.log(`Body length: ${sanitized.body.length} chars`);
console.log(`\nExtracted metadata:`);
console.log(`  - Meta description: ${sanitized.metaDescription?.substring(0, 60)}...`);
console.log(`  - Keywords: ${sanitized.keywords?.join(", ") || "none"}`);
console.log(`  - Excerpt: ${sanitized.excerpt.substring(0, 60)}...`);

console.log(`\nHTML output preview:`);
console.log(sanitized.body.substring(0, 200) + "...");

console.log("\n" + "=".repeat(80));
console.log("VERIFICATION (HTML OUTPUT):");
console.log("-".repeat(80));

// CRITICAL: Check the FINAL HTML output, not intermediate text
const checks = {
  "seo_blog_removed_from_title": !sanitized.title.toLowerCase().includes("seo blog"),
  "meta_description_removed_from_html": !sanitized.body.toLowerCase().includes("meta description"),
  "relevant_keywords_removed_from_html": !sanitized.body.toLowerCase().includes("relevant keywords"),
  "keywords_colon_removed_from_html": !sanitized.body.toLowerCase().includes("keywords:"),
  "markdown_hash_removed": !sanitized.body.includes("##"),
  "markdown_asterisk_removed": !sanitized.body.includes("**"),
  "horizontal_rules_removed": !sanitized.body.includes("—————"),
  
  // NEW: Strict checks for metadata/excerpt leakage (CRITICAL)
  "meta_label_not_in_metaDescription": !sanitized.metaDescription || !sanitized.metaDescription.toLowerCase().startsWith("meta description"),
  "meta_label_not_in_excerpt": !sanitized.excerpt.toLowerCase().startsWith("meta description"),
};

let allPassed = true;
for (const [check, passed] of Object.entries(checks)) {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`  ${status}: ${check}`);
  if (!passed) allPassed = false;
}

console.log("\n" + "=".repeat(80));
if (allPassed) {
  console.log("✅ TEST PASSED: Sanitizer removes all artifacts from HTML AND metadata");
} else {
  console.log("❌ TEST FAILED: Artifacts found in output");
  console.log("\nDEBUG - Full sanitized output:");
  console.log("Title:", sanitized.title);
  console.log("MetaDescription:", sanitized.metaDescription);
  console.log("Excerpt:", sanitized.excerpt);
  console.log("HTML preview:", sanitized.body.substring(0, 300));
}
console.log("=".repeat(80) + "\n");

process.exit(allPassed ? 0 : 1);
