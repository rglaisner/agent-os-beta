from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the app
            page.goto("http://localhost:5173")

            # Wait for content
            page.wait_for_timeout(5000) # Give it some time to load

            # Navigate to Monitor tab
            monitor_btn = page.get_by_role("button", name="Live Monitor")
            if monitor_btn.is_visible():
                monitor_btn.click()
                print("Clicked Monitor Button")

            # Check for the terminal interface
            # page.wait_for_selector("text=Live Terminal")

            # Take a screenshot
            page.screenshot(path="verification/verification.png")
            print("Screenshot taken successfully")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_frontend()
