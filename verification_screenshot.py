from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        page.goto("http://localhost:5173")
        page.wait_for_selector('button:has-text("Setup")') # Top nav button
        page.screenshot(path="verification.png")
        browser.close()

if __name__ == "__main__":
    run()
