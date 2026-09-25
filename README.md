# Signal — Alert Voice

This is the source for the existing public ChatGPT Site:
https://signal-alert-voice.dxliang.chatgpt.site

Open `dist/index.html` in a browser to test it locally. The Site is plain static HTML and has no build step. Keep `.openai/hosting.json` with the source: its project ID links this folder to the existing Site.

The current app sorts manually entered sample emails and texts into two columns. Low priority plays a soft sound only; urgent work plays a distinct sound and speaks “Urgent job message. Please check.” It does not connect to a live inbox or receive real texts.

For a public GitHub copy, create a new repository and commit these source files. The Site’s production version is managed through ChatGPT Sites; editing this folder by itself does not update the live URL.
