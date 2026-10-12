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

  // Test country code formatting via Wasm
  const phoneTest = await page.evaluate(() => {
    return {
      nigeria: (window as any).__wasmCleanPhone?.("2348062795602"),
      ghana: (window as any).__wasmCleanPhone?.("233533763772"),
      brazil: (window as any).__wasmCleanPhone?.("559984726662"),
      us: (window as any).__wasmCleanPhone?.("15551234567"),
    };
  });
  console.log("Phone formatting test:", phoneTest);

  // 2. Test Status tab deduplication
  console.log("Testing Status tab...");
  const statusTabBtn = page.locator("button:has-text('Status')").first();
  if ((await statusTabBtn.count()) > 0) {
    await statusTabBtn.click();
    await page.waitForTimeout(800);

    const statusItems = page.locator("div[class*='cursor-pointer']:has(span.rounded-full:has-text(''))");
    const count = await statusItems.count();
    console.log(`Grouped status contacts count: ${count}`);

    // Capture screenshot of deduplicated status list
    await page.screenshot({ path: "tests/status_list.png" });
    console.log("Captured tests/status_list.png");

    // Click on the first status contact to open story viewer
    const firstStatus = page.locator("div[class*='cursor-pointer'][key*='status-group']").first();
    if ((await firstStatus.count()) > 0) {
      await firstStatus.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: "tests/status_story_viewer.png" });
      console.log("Captured tests/status_story_viewer.png");

      // Close status modal
      const closeBtn = page.locator("div[class*='fixed'] button:has(svg.lucide-x)").first();
      if ((await closeBtn.count()) > 0) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Switch back to 'all' chats tab
    const allTabBtn = page.locator("button:has-text('All')").first();
    await allTabBtn.click();
    await page.waitForTimeout(500);
  }

  // 3. Test active chat and Group Info Drawer (admins first, pushnames, phone formatting)
  console.log("Testing group chats and drawer...");
  const groupChat = page.locator("div[class*='cursor-pointer']:has-text('WASOCKET CHAT')").first();
  if ((await groupChat.count()) > 0) {
    await groupChat.click();
  } else {
    const firstChat = page.locator("aside div[class*='cursor-pointer']").first();
    await firstChat.click();
  }
  await page.waitForTimeout(1000);

  // Open Chat Info / Group Settings drawer
  const chatHeaderTitle = page.locator("header h3").first();
  await chatHeaderTitle.click();
  await page.waitForTimeout(800);

  await page.screenshot({ path: "tests/group_participants_drawer.png" });
  console.log("Captured tests/group_participants_drawer.png");

  // 4. Test quoted message tap-to-jump
  const quoteBox = page.locator("div[class*='group/quote']").first();
  if ((await quoteBox.count()) > 0) {
    console.log("Testing quoted message click...");
    await quoteBox.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "tests/quoted_message_jump.png" });
    console.log("Captured tests/quoted_message_jump.png");
  }

  await browser.close();
  console.log("Playwright UI verification finished successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
