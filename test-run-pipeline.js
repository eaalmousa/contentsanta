// Simple test: Call the run-pipeline endpoint with proper authentication

const BASE_URL = "http://127.0.0.1:5000";
const TOPIC_ID = "05f340fc-5a36-4781-9348-ed582f50a1d9"; // Your Real Estate topic

async function testRunPipeline() {
  console.log("\n=== Testing Run Pipeline Endpoint ===\n");
  
  try {
    // Step 1: Establish session
    console.log("Step 1: Getting session cookie...");
    const loginRes = await fetch(`${BASE_URL}/api/dev/session`, {
      method: "GET",
      redirect: "manual"
    });
    
    const setCookie = loginRes.headers.get("set-cookie");
    if (!setCookie) {
      console.error("❌ No session cookie received from login!");
      return;
    }
    
    const cookie = setCookie.split(";")[0];
    console.log(`✓ Session cookie: ${cookie.substring(0, 40)}...\n`);
    
    // Step 2: Verify authentication
    console.log("Step 2: Verifying authentication...");
    const meRes = await fetch(`${BASE_URL}/api/me/context`, {
      headers: { "Cookie": cookie }
    });
    
    if (meRes.status !== 200) {
      console.error(`❌ Auth check failed: ${meRes.status}`);
      return;
    }
    
    const meData = await meRes.json();
    console.log(`✓ Authenticated as: ${meData.user?.email || "unknown"}`);
    console.log(`✓ Workspace: ${meData.activeWorkspaceId}\n`);
    
    // Step 3: Call run-pipeline endpoint
    console.log("Step 3: Calling run-pipeline endpoint...");
    console.log(`  URL: POST ${BASE_URL}/api/topics/${TOPIC_ID}/run-pipeline`);
    
    const pipelineRes = await fetch(`${BASE_URL}/api/topics/${TOPIC_ID}/run-pipeline`, {
      method: "POST",
      headers: { 
        "Cookie": cookie,
        "Content-Type": "application/json"
      }
    });
    
    console.log(`  Status: ${pipelineRes.status} ${pipelineRes.statusText}`);
    
    if (pipelineRes.status !== 200) {
      const errorText = await pipelineRes.text();
      console.error(`❌ Pipeline failed:`);
      console.error(errorText);
      return;
    }
    
    const pipelineData = await pipelineRes.json();
    console.log(`✓ Pipeline started successfully!`);
    console.log(`\nResults:`, JSON.stringify(pipelineData, null, 2));
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testRunPipeline();
