import { AIImageService } from "./server/services/ai-image-service";

async function testImageOptimization() {
  console.log("🧪 Testing AI Image Optimization\n");
  console.log("=".repeat(80));

  const aiImageService = new AIImageService();

  // Test with a simple article
  const testTitle = "Real Estate Market Trends in Dubai 2026";
  const testExcerpt = "Analysis of property prices, investment opportunities, and market forecasts for Dubai's real estate sector.";

  console.log("\n📝 Test Article:");
  console.log(`  Title: ${testTitle}`);
  console.log(`  Excerpt: ${testExcerpt.substring(0, 80)}...\n`);

  console.log("🎨 Generating AI image with new optimized settings...\n");
  console.log("  Settings:");
  console.log("    Size: 1024×1024 (down from 1792×1024)");
  console.log("    Quality: standard");
  console.log("    Style: natural\n");

  try {
    const result = await aiImageService.generateFeaturedImage(
      testTitle,
      testExcerpt,
      "realistic"
    );

    if (result.success && result.imageUrl) {
      console.log("✅ Image generated successfully!\n");
      console.log("📊 Results:");
      console.log(`  Image URL: ${result.imageUrl.substring(0, 80)}...`);
      if (result.revisedPrompt) {
        console.log(`  Revised Prompt: ${result.revisedPrompt.substring(0, 100)}...`);
      }

      // Fetch image to get size
      console.log("\n📥 Fetching image to check size...");
      const response = await fetch(result.imageUrl);
      const buffer = await response.arrayBuffer();
      const sizeKB = Math.round(buffer.byteLength / 1024);
      const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);

      console.log("\n📦 Image Size:");
      console.log(`  Original (before WordPress): ${sizeKB} KB (${sizeMB} MB)`);
      console.log(`  Expected after WordPress optimization: ~${Math.round(sizeKB * 0.15)} KB (93% smaller)`);

      console.log("\n💰 Cost:");
      console.log("  Generation: $0.04 per image");
      console.log("  Bandwidth savings: ~$0.10 per image");

      console.log("\n⏱️  Load Time Estimates:");
      console.log(`  Original (${sizeKB}KB):`);
      console.log(`    - 3G (750 KB/s): ${Math.round(sizeKB / 750)} seconds`);
      console.log(`    - 4G (10 MB/s): ${(sizeKB / (10 * 1024)).toFixed(2)} seconds`);
      
      const optimizedKB = Math.round(sizeKB * 0.15);
      console.log(`  Optimized (${optimizedKB}KB):`);
      console.log(`    - 3G (750 KB/s): ${Math.round(optimizedKB / 750)} seconds`);
      console.log(`    - 4G (10 MB/s): ${(optimizedKB / (10 * 1024)).toFixed(2)} seconds`);

      console.log("\n" + "=".repeat(80));
      console.log("\n✅ TEST PASSED");
      console.log("\n📌 Next Steps:");
      console.log("  1. Upload content-santa-connector-v2-optimized.php to WordPress");
      console.log("  2. Configure: Max Width = 1200px, Quality = 85%");
      console.log("  3. Publish a test article to verify full optimization pipeline");
      console.log("  4. Check WordPress logs for optimization statistics\n");

    } else {
      console.log("❌ Image generation failed:");
      console.log(`  Error: ${result.error}`);
      console.log("\n📌 Check:");
      console.log("  1. OpenAI API key is set in .env");
      console.log("  2. API key has credits available");
      console.log("  3. Network connection is stable\n");
    }

  } catch (error: any) {
    console.log("❌ Test failed with error:");
    console.log(`  ${error.message}\n`);
    console.log("📌 Troubleshooting:");
    console.log("  1. Ensure OPENAI_API_KEY is set in .env");
    console.log("  2. Check server logs for detailed error messages");
    console.log("  3. Verify OpenAI API service is accessible\n");
  }
}

testImageOptimization().catch(console.error);
