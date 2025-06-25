const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const videoId = process.env.VIDEO_ID;
const segmentId = process.env.SEGMENT_ID;
const duration = parseFloat(process.env.DURATION);
const html = process.env.HTML;

(async () => {
  const htmlPath = `index.html`;
  fs.writeFileSync(htmlPath, html, 'utf-8');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`file://${process.cwd()}/${htmlPath}`);

  const frames = Math.floor(duration * 10); // 10fps
  const interval = 100;
  fs.mkdirSync('frames', { recursive: true });

  for (let i = 0; i < frames; i++) {
    const filename = `frames/frame_${String(i).padStart(3, '0')}.png`;
    await page.screenshot({ path: filename });
    await page.waitForTimeout(interval);
  }

  await browser.close();

  execSync('ffmpeg -y -r 10 -i frames/frame_%03d.png -c:v libx264 -pix_fmt yuv420p out.mp4');

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const mp4 = fs.readFileSync('out.mp4');

  const { error } = await supabase.storage
    .from('projects')
    .upload(`${videoId}/${segmentId}/animated.mp4`, mp4, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (error) throw error;
})();
