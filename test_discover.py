from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Go to the discover page
    page.goto('http://localhost:3000/discover')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    
    # Take screenshot
    page.screenshot(path='discover-page.png', full_page=True)
    
    # Get page content for inspection
    print('Page title:', page.title())
    print('URL:', page.url)
    
    # Check for discover page elements
    print('Page loaded, taking full page screenshot...')
    
    # Get all buttons
    buttons = page.locator('button').all()
    print(f'Found {len(buttons)} buttons')
    for i, btn in enumerate(buttons[:10]):
        print(f'  Button {i}: {btn.text_content()[:50]}')
    
    # Check for search/category elements
    search = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]').first
    if search.count() > 0:
        print('Found search input:', search.get_attribute('placeholder'))
    
    # Check for category filters
    categories = page.locator('[role="tablist"] button, .category, [data-category]').all()
    print(f'Found {len(categories)} category tabs/filters')
    
    # Check for video cards
    video_cards = page.locator('[data-testid*="video"], .video-card, article').all()
    print(f'Found {len(video_cards)} potential video cards')
    
    browser.close()