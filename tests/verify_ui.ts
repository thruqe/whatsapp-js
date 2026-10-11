import { chromium } from "playwright";

async function main() {
  console.log("Starting Playwright UI Verification...");
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000 ...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Verify Wasm functions
  const wasmReady = await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      if ((window as any).__wasmReady) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return Boolean((window as any).__wasmReady);
  });
  console.log(`Wasm ready: ${wasmReady}`);

  // 2. Click the first chat item in sidebar
  const chatItem = page.locator("aside div[class*='cursor-pointer']").first();
  if ((await chatItem.count()) > 0) {
    console.log("Clicking first chat item...");
    await chatItem.click();
    await page.waitForTimeout(1000);

    // Take screenshot of active chat with visible doodles
    await page.screenshot({ path: "tests/chat_with_doodles.png" });
    console.log("Captured tests/chat_with_doodles.png");

    // Click on chat header to open Group / Chat Info drawer
    console.log("Clicking chat header to open Group Info / Settings drawer...");
    const chatHeaderTitle = page.locator("header h3").first();
    await chatHeaderTitle.click();
    await page.waitForTimeout(800);

    await page.screenshot({ path: "tests/group_info_drawer.png" });
    console.log("Captured tests/group_info_drawer.png");

    // Check right-click on chat item in sidebar
    console.log("Triggering right-click on chat item in sidebar...");
    await chatItem.click({ button: "right" });
    await page.waitForTimeout(500);

    await page.screenshot({ path: "tests/right_click_menu_new.png" });
    console.log("Captured tests/right_click_menu_new.png");
  }

  await browser.close();
  console.log("Playwright UI verification finished successfully!");
}

main().catch((err) => {
  console.error("Playwright test failed:", err);
  process.exit(1);
});
