# Sticky Task Board

A personal task board that runs on PC, Mac, iPhone and iPad as one installable web app (PWA).

- **Board:** project columns of sticky-note tasks. Drag to reorder or move between projects (long-press to drag on touch screens).
- **Sub-tasks:** each sub-task has its own time estimate, and together they make up the task's estimate.
- **Focus:** a minimal view of one project's active task with a countdown ring. Time is booked to the current sub-task. When you check the task off, it moves to **Done** and the next task down the column becomes active.
- **Map:** a mind-map overview of projects, tasks and sub-tasks.
- **Quick add:** the orange + button, built for adding tasks quickly on the phone.
- **Google Drive sync:** the board is stored as one JSON file in Drive's hidden app folder, and every device keeps an offline copy. If two devices change things at once, the most recent change wins.

## Run locally

```sh
npm install
npm run dev      # http://localhost:5173/sticky-task-board/
npm test
npm run build    # output in dist/
```

## Hosting

`.github/workflows/deploy.yml` publishes `main` to GitHub Pages at `https://mechanika.github.io/sticky-task-board/`.
Turn it on under **Settings → Pages → Source: GitHub Actions**.

GitHub Pages for a **private** repo needs a paid GitHub plan. If yours is free, you have two options:
- Make the repo public. It holds no personal data, because your tasks live in your Google Drive.
- Or host it free on Netlify or Cloudflare Pages: connect the repo, use build command `npm run build`, output folder `dist`, and set the environment variable `BASE_PATH=/`.

## Google Drive sync setup (one time, free)

1. Go to <https://console.cloud.google.com/>, create a project, and enable the **Google Drive API**.
2. Under **APIs & Services → OAuth consent screen**, choose **External**, fill in the app name, and add yourself as a **test user**.
3. Under **Credentials → Create credentials → OAuth client ID**, choose **Web application**, and add your hosting address
   (e.g. `https://mechanika.github.io`) and `http://localhost:5173` under **Authorised JavaScript origins**.
4. Copy the client ID, open the app, tap ⚙, paste the ID, save it, and tap **Connect Google Drive**. Do this once on each device.
   (Or set it once as the repository variable `GOOGLE_CLIENT_ID` so the build includes it.)

The app asks only for the `drive.appdata` permission, so it can see its own file and nothing else in your Drive.
Google sign-ins last about an hour. When one expires, a "Tap to reconnect" bar appears and one tap renews it.

## Install on each device

- **iPhone / iPad:** open the site in Safari, tap Share, then **Add to Home Screen**.
- **Mac:** in Safari, choose File → **Add to Dock**. In Chrome, use the install icon in the address bar.
- **Windows PC:** in Chrome or Edge, use the install icon in the address bar.
