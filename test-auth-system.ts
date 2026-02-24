// Test Authentication Endpoints

const BASE_URL = "http://localhost:5000";

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function testSignup() {
  console.log("\n🧪 Testing Signup...");
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `test${Date.now()}@example.com`,
        password: "password123",
        firstName: "Test",
        lastName: "User",
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.ok) {
      results.push({
        test: "Signup",
        passed: true,
        message: "✅ User created successfully",
        data: { userId: data.user?.id, email: data.user?.email },
      });
      return data.user;
    } else {
      results.push({
        test: "Signup",
        passed: false,
        message: `❌ Signup failed: ${data.error}`,
      });
      return null;
    }
  } catch (error: any) {
    results.push({
      test: "Signup",
      passed: false,
      message: `❌ Network error: ${error.message}`,
    });
    return null;
  }
}

async function testLogin(email: string, password: string) {
  console.log("\n🧪 Testing Login...");
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.ok) {
      results.push({
        test: "Login",
        passed: true,
        message: "✅ Login successful",
        data: { userId: data.user?.id, email: data.user?.email },
      });
      return true;
    } else {
      results.push({
        test: "Login",
        passed: false,
        message: `❌ Login failed: ${data.error}`,
      });
      return false;
    }
  } catch (error: any) {
    results.push({
      test: "Login",
      passed: false,
      message: `❌ Network error: ${error.message}`,
    });
    return false;
  }
}

async function testLoginInvalidPassword(email: string) {
  console.log("\n🧪 Testing Login with Invalid Password...");
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "wrongpassword" }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      results.push({
        test: "Invalid Login",
        passed: true,
        message: "✅ Correctly rejected invalid password",
      });
      return true;
    } else {
      results.push({
        test: "Invalid Login",
        passed: false,
        message: "❌ Should have rejected invalid password",
      });
      return false;
    }
  } catch (error: any) {
    results.push({
      test: "Invalid Login",
      passed: false,
      message: `❌ Network error: ${error.message}`,
    });
    return false;
  }
}

async function testDuplicateSignup(email: string) {
  console.log("\n🧪 Testing Duplicate Signup...");
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "password123",
        firstName: "Test",
        lastName: "User",
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok && data.error?.includes("already")) {
      results.push({
        test: "Duplicate Signup",
        passed: true,
        message: "✅ Correctly rejected duplicate email",
      });
      return true;
    } else {
      results.push({
        test: "Duplicate Signup",
        passed: false,
        message: "❌ Should have rejected duplicate email",
      });
      return false;
    }
  } catch (error: any) {
    results.push({
      test: "Duplicate Signup",
      passed: false,
      message: `❌ Network error: ${error.message}`,
    });
    return false;
  }
}

async function testWeakPassword() {
  console.log("\n🧪 Testing Weak Password...");
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `test${Date.now()}@example.com`,
        password: "weak",
        firstName: "Test",
        lastName: "User",
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok && data.error?.includes("8 characters")) {
      results.push({
        test: "Weak Password",
        passed: true,
        message: "✅ Correctly rejected weak password",
      });
      return true;
    } else {
      results.push({
        test: "Weak Password",
        passed: false,
        message: "❌ Should have rejected weak password",
      });
      return false;
    }
  } catch (error: any) {
    results.push({
      test: "Weak Password",
      passed: false,
      message: `❌ Network error: ${error.message}`,
    });
    return false;
  }
}

async function runTests() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🧪 AUTHENTICATION SYSTEM TEST SUITE");
  console.log("═══════════════════════════════════════════════");
  
  // Test 1: Signup
  const user = await testSignup();
  
  if (user) {
    // Test 2: Login with correct password
    await testLogin(user.email, "password123");
    
    // Test 3: Login with wrong password
    await testLoginInvalidPassword(user.email);
    
    // Test 4: Duplicate signup
    await testDuplicateSignup(user.email);
  }
  
  // Test 5: Weak password
  await testWeakPassword();
  
  // Print Results
  console.log("\n═══════════════════════════════════════════════");
  console.log("  📊 TEST RESULTS");
  console.log("═══════════════════════════════════════════════\n");
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.test}: ${result.message}`);
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data)}`);
    }
  });
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log("\n═══════════════════════════════════════════════");
  console.log(`  ${passed}/${total} Tests Passed`);
  console.log("═══════════════════════════════════════════════\n");
  
  if (passed === total) {
    console.log("✅ All tests passed! Authentication system is working correctly.");
  } else {
    console.log("❌ Some tests failed. Please review the errors above.");
  }
  
  process.exit(passed === total ? 0 : 1);
}

runTests().catch((error) => {
  console.error("❌ Test suite failed:", error);
  process.exit(1);
});
