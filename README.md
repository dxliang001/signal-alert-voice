# Signal — Alert Voice

This is the source for the existing public ChatGPT Site:
https://signal-alert-voice.dxliang.chatgpt.site

Open `dist/index.html` in a browser to test it locally. The Site is plain static HTML and has no build step. Keep `.openai/hosting.json` with the source: its project ID links this folder to the existing Site.

The current app sorts manually entered sample emails and texts into two columns. Low priority plays a soft sound only; urgent school or work messages play a distinct sound and say “Urgent message. Please check.” It does not connect to a live inbox or receive real texts.

Add trusted school/work contacts, then load the five examples (two urgent and three low priority with default rules). “Try tricky messages” loads five examples that should all remain low priority under default rules. Loading examples is silent; use each card's Play button to hear its alert.

Trusted contacts need an immediate request or an explicit deadline today/tonight. Subscription signals take precedence over trust and always-urgent rules. Sorting uses phrase matching, not semantic understanding or authenticated sender verification. A deadline tomorrow is not treated as urgent by itself.

Each card supports a one-time move and saved sender rules. Saved rule changes re-sort the visible inbox silently, replacing one-time moves. Contact preferences stay in this browser; demo messages are not persisted. Edit or remove saved rules under “Adjust the sorting rules.”

Alerts play sequentially so urgent speech is not interrupted by the next message. Stop alerts clears pending playback. Changing an audio checkbox also stops pending alerts. Browser audio permissions, speech support, and background-tab restrictions still apply; use the previews to check playback on your device.

Run the automated behavior checks with Node.js 22 or later:

```sh
node --test --experimental-test-isolation=none tests/prototype.test.cjs
```

These checks exercise sorting, sender-rule persistence, and alert sequencing with mocked browser audio APIs. They do not verify audible output from speakers.

For a public GitHub copy, create a new repository and commit these source files. The Site’s production version is managed through ChatGPT Sites; editing this folder by itself does not update the live URL.
