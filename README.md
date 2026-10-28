# Remix Studio AI (MVP)

A Vietnamese browser-based starter project for making 10 creative product-video variants in vertical 9:16 format.

## Included
- Cloudflare Pages static frontend (`index.html`, `style.css`, `app.js`)
- Cloudflare Worker (`worker.js`) with `POST /api/scripts` and `POST /api/voice`
- AI-generated Vietnamese voiceover scripts using a few sampled video frames + product facts supplied by the user
- AI voice generation endpoint
- Browser-side FFmpeg.wasm rendering: crops source video to 9:16, replaces source audio with generated narration, exports MP4

## Important MVP limits
- The first version renders the same source footage with different voiceovers; it does not yet automatically splice supplemental B-roll into the timeline or burn subtitles into the video.
- The B-roll upload field is currently a reference input only.
- Rendering 10 videos in a browser can consume substantial RAM and CPU. Test one short video first.
- Do not use this to evade platform duplicate-content checks. Meaningful creative changes, proper rights, and accurate advertising claims matter; no detection outcome is guaranteed.
- Use only video/audio/extra footage you own or are licensed to use.

## Deploy frontend to Cloudflare Pages
1. Upload this folder to a Git repository.
2. Create a Cloudflare Pages project from that repository.
3. Framework preset: `None`; build command empty; output directory `/` (or project root, depending on the Pages setup screen).
4. Deploy. The FFmpeg browser build is loaded from a public CDN, so the browser needs network access.

## Deploy Worker API
1. Install Wrangler locally: `npm install -g wrangler`.
2. Log in: `wrangler login`.
3. In this folder, set the secret: `wrangler secret put OPENAI_API_KEY` and paste your OpenAI API key into the terminal prompt. Never put it in `index.html`, `app.js`, or a public repository.
4. Deploy: `wrangler deploy`.
5. Copy the Worker URL (for example `https://remix-studio-ai-worker.<account>.workers.dev`) into the “Địa chỉ API Worker” field on the site.
6. For production, replace wildcard CORS in `worker.js` with your exact Pages origin and add rate limiting/authentication so others cannot spend your API budget.

## Test flow
1. Open the Pages site in a current desktop browser.
2. Select a video shorter than 60 seconds and enter accurate product facts.
3. Use “Tạo 10 kịch bản AI” after deploying the Worker, or “Dùng kịch bản mẫu” for UI testing.
4. Review/edit scripts.
5. Create narration for each script, then render the MP4s.

## Troubleshooting
- If the AI call fails, check Worker logs and confirm `OPENAI_API_KEY` is set.
- If the browser reports a SharedArrayBuffer / cross-origin isolation error, verify `_headers` is deployed and reload the page.
- If rendering fails or the tab crashes, try a smaller/shorter input and process fewer variants per session.
