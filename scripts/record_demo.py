import asyncio
import os
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

async def run():
    media_dir = Path("demo_media")
    media_dir.mkdir(exist_ok=True)
    raw_video_dir = media_dir / "raw_video"
    raw_video_dir.mkdir(exist_ok=True)

    # Clean old webm
    for f in raw_video_dir.glob("*.webm"):
        f.unlink()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1500, "height": 920},
            record_video_dir=str(raw_video_dir),
            record_video_size={"width": 1500, "height": 920}
        )
        page = await context.new_page()

        print("1. Loading SkyFi Cyber Login Portal...")
        await page.goto("http://localhost:5173")
        await page.wait_for_timeout(1500)
        await page.screenshot(path="demo_media/01_skyfi_login.png")

        print("2. Authenticating Command Terminal...")
        login_btn = page.locator("button[type='submit']")
        await login_btn.click()
        await page.wait_for_timeout(2500)
        await page.screenshot(path="demo_media/02_skyfi_dashboard.png")

        print("3. Inspecting Camera Stream & Deep Telemetry Flyout...")
        # Click on the first camera card in the sidebar
        first_card = page.locator("[data-testid='camera-card']").first
        if await first_card.count() > 0:
            await first_card.click()
            await page.wait_for_timeout(2500)
            await page.screenshot(path="demo_media/03_skyfi_camera_inspector.png")

        print("4. Testing Multi-Basemap Switching (Esri Satellite)...")
        sat_btn = page.get_by_role("button", name="Satellite")
        if await sat_btn.count() > 0:
            await sat_btn.click()
            await page.wait_for_timeout(2500)
            await page.screenshot(path="demo_media/04_skyfi_satellite_basemap.png")

        # Switch back to Dark Canvas
        dark_btn = page.locator("button:has-text('Dark Canvas')")
        if await dark_btn.count() > 0:
            await dark_btn.click()
            await page.wait_for_timeout(1500)

        print("5. Toggling PostGIS Spatial Coverage Gaps & Buffers...")
        gaps_btn = page.locator("button:has-text('Gap Grid')")
        if await gaps_btn.count() > 0:
            await gaps_btn.click()
        buffers_btn = page.locator("button:has-text('Buffers')")
        if await buffers_btn.count() > 0:
            await buffers_btn.click()
        await page.wait_for_timeout(3000)
        await page.screenshot(path="demo_media/05_skyfi_gap_heatmap.png")

        print("6. Demonstrating Hackathon Vehicle Tracker & Watchlist Match...")
        trace_btn = page.get_by_role("button", name="Vehicle Trace")
        if await trace_btn.count() > 0:
            await trace_btn.click()
            await page.wait_for_timeout(2500)
            await page.screenshot(path="demo_media/06_skyfi_vehicle_trace.png")

        print("7. Opening Glassmorphic Onboarding Modal...")
        onboard_btn = page.get_by_role("button", name="Onboard")
        if await onboard_btn.count() > 0:
            await onboard_btn.click()
            await page.wait_for_timeout(2000)
            await page.screenshot(path="demo_media/07_skyfi_onboarding_modal.png")

        # Smooth concluding view
        close_modal = page.locator("div[role='dialog'] button, .fixed.inset-0 button").first
        if await close_modal.count() > 0:
            await close_modal.click()
        await page.wait_for_timeout(2500)

        await page.close()
        await context.close()
        await browser.close()

    # Convert webm to mp4 via ffmpeg
    videos = list(raw_video_dir.glob("*.webm"))
    if videos:
        latest_video = max(videos, key=os.path.getctime)
        mp4_path = media_dir / "sentinel_demo_walkthrough.mp4"
        print(f"Converting {latest_video} to {mp4_path}...")
        cmd = [
            "/opt/homebrew/bin/ffmpeg", "-y",
            "-i", str(latest_video),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            str(mp4_path)
        ]
        subprocess.run(cmd, check=True)
        print(f"SUCCESS: Recorded video saved to {mp4_path}")

if __name__ == "__main__":
    asyncio.run(run())
