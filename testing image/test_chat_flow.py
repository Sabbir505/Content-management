from playwright.sync_api import sync_playwright
import json, urllib.parse

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    errors = []
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error",) else None)
    page.on("pageerror", lambda err: errors.append(f"[pageerror] {err}"))

    page.goto("http://localhost:3000/discover", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(5000)
    page.evaluate("""() => {
        const overlays = document.querySelectorAll('nextjs-portal, [data-nextjs-dev-overlay]');
        overlays.forEach(o => o.remove());
    }""")
    page.wait_for_timeout(500)

    # Open settings
    page.locator('button[aria-label="Settings"]').first.click()
    page.wait_for_timeout(1000)
    page.evaluate("""() => {
        const overlays = document.querySelectorAll('nextjs-portal, [data-nextjs-dev-overlay]');
        overlays.forEach(o => o.remove());
    }""")
    page.wait_for_timeout(500)

    # Select OpenAI Compatible
    provider_select = page.locator("select").first
    for i, opt in enumerate(provider_select.locator("option").all()):
        if opt.text_content() and "OpenAI" in opt.text_content():
            provider_select.select_option(index=i)
            break
    page.wait_for_timeout(500)

    page.locator('input[type="password"]').fill("sk-84fe0942e39eb903e53254883a9d97cf0d1dada54003299336adface8b1f3000")
    page.wait_for_timeout(300)
    page.locator('input[placeholder*="api.openai.com"]').fill("https://ai2.18.show/v1/chat/completions")
    page.wait_for_timeout(300)
    page.locator('input[placeholder="gpt-4o"]').fill("DeepSeek-V4-Pro")
    page.wait_for_timeout(300)

    # Save
    page.locator("button", has_text="Save").first.click()
    page.wait_for_timeout(1000)

    # Verify cookie
    cookies = context.cookies()
    llm_cookie = [c for c in cookies if c["name"] == "tubeforge_llm_config"]
    if llm_cookie:
        val = urllib.parse.unquote(llm_cookie[0]["value"])
        print(f"Cookie: {val}")

    # Close settings by clicking the X button inside the modal
    page.evaluate("""() => {
        const backdrop = document.querySelector('[class*="fixed inset-0 z-[9999]"]');
        if (backdrop) {
            const closeBtn = backdrop.querySelector('button');
            if (closeBtn) closeBtn.click();
        }
    }""")
    page.wait_for_timeout(1000)
    page.screenshot(path="D:/Projects/Main project/Content flow/tubeforge/testing image/04_settings_closed.png")

    # Now click Chat nav
    page.locator("button", has_text="Chat").first.click()
    page.wait_for_timeout(3000)
    page.screenshot(path="D:/Projects/Main project/Content flow/tubeforge/testing image/05_chat.png")
    print(f"URL: {page.url}")

    # Type message
    textarea = page.locator("textarea").last
    print(f"Textareas found: {textarea.count()}")
    if textarea.count() > 0:
        textarea.fill("Say hello in one word")
        page.wait_for_timeout(500)
        page.screenshot(path="D:/Projects/Main project/Content flow/tubeforge/testing image/06_typed.png")
        textarea.press("Enter")
        page.wait_for_timeout(12000)
        page.screenshot(path="D:/Projects/Main project/Content flow/tubeforge/testing image/07_response.png")

    print(f"\nErrors: {len(errors)}")
    for e in errors[:10]:
        print(f"  {e[:300]}")

    browser.close()
    print("Done")
