from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    errors = []
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda err: errors.append(f"[pageerror] {err}"))

    page.goto("http://localhost:3000/discover", wait_until="networkidle", timeout=30000)
    page.screenshot(path="D:/Projects/Main project/Content flow/tubeforge/testing image/settings_initial.png", full_page=True)

    settings_btn = page.locator('button[aria-label="Settings"]')
    print(f"Settings buttons found: {settings_btn.count()}")
    settings_btn.first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path="D:/Projects/Main project/Content flow/tubeforge/testing image/settings_open.png", full_page=True)

    provider_select = page.locator("select").first
    options = provider_select.locator("option").all()
    option_texts = [o.text_content() for o in options]
    print(f"Provider options: {option_texts}")

    for i, opt in enumerate(options):
        if opt.text_content() and "OpenAI" in opt.text_content():
            provider_select.select_option(index=i)
            break

    page.wait_for_timeout(500)
    page.screenshot(path="D:/Projects/Main project/Content flow/tubeforge/testing image/settings_openai.png", full_page=True)

    endpoint_input = page.locator('input[placeholder*="api.openai.com"]')
    print(f"Endpoint input found: {endpoint_input.count()}")
    if endpoint_input.count() > 0:
        print(f"Endpoint input disabled: {endpoint_input.is_disabled()}")
        print(f"Endpoint value: {endpoint_input.input_value()}")

    model_input = page.locator('input[placeholder="gpt-4o"]')
    print(f"Model input found: {model_input.count()}")

    panel = page.locator(".relative.w-full.max-w-3xl")
    if panel.count() > 0:
        box = panel.bounding_box()
        print(f"Panel width: {box['width'] if box else 'N/A'}")

    print(f"\nConsole errors: {len(errors)}")
    for e in errors[:5]:
        print(f"  {e}")

    browser.close()
    print("\nDone")
