from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Go to homepage
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    
    page.screenshot(path='homepage.png', full_page=True)
    print('Homepage title:', page.title())
    print('Homepage URL:', page.url)
    
    # Check for links to discover
    links = page.locator('a[href*="discover"]').all()
    print(f'Found {len(links)} links to discover')
    for link in links:
        print(f'  Link: {link.text_content()[:50]} -> {link.get_attribute("href")}')
    
    # Check all navigation links
    nav_links = page.locator('nav a, header a').all()
    print(f'Found {len(nav_links)} nav/header links')
    for link in nav_links:
        print(f'  Nav: {link.text_content()[:50]} -> {link.get_attribute("href")}')
    
    # Try clicking discover link if exists
    if links:
        links[0].click()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(3000)
        page.screenshot(path='discover-after-click.png', full_page=True)
        print('After click - URL:', page.url)
        print('After click - Title:', page.title())
    
    browser.close()