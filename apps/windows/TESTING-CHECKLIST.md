# Daisy Assistant — release test checklist

Run this on a clean Windows machine (not a developer machine) after installing
`DaisyAssistant-Setup-x64.exe`. Every line is something a real user does. If a
step fails, note the step number and attach the support report from step 12.

## Where the logs are

| What | Path |
| --- | --- |
| Engine log (one per day) | `%LOCALAPPDATA%\Temp\daisyclaw\daisyclaw-<date>.log` |
| Install-time engine setup | `%LOCALAPPDATA%\DaisyAssistant\gateway-setup.log` |
| Tray app | `%LOCALAPPDATA%\DaisyAssistant\daisyclaw-tray.log` |

Settings → "Something wrong?" → **Create support report** gathers all of it into
one redacted zip and shows the path.

## Before you build

The consumer smoke suite runs the shipped engine through the first-run paths
below and the installer build refuses to produce an `.exe` unless it passes. Run
it on its own with:

```
node --import tsx apps/windows/scripts/consumer-smoke/run.mjs
```

It uses its own port, scheduled task and state directory, so it never touches
the gateway on the machine you run it from.

## Upgrading a PC that already has Daisy

Run this on a PC where an earlier build is installed, before the fresh-install
pass below. Quit Daisy from the tray icon first, then run the new installer over
the top (do not uninstall).

1. The window opens by itself and shows chat, or the setup wizard if setup was
   never finished. It must never show a login form, a "Gateway Dashboard" page,
   a token field, or "Auth did not match".
2. Within a minute the tray icon is green and its tooltip says connected. The
   window and the tray must agree: "Connected" on one and "Connection error" on
   the other is a failure.
3. Your earlier chats and settings are still there.

If the window ever shows "Daisy couldn't sign in", wait one minute, then press
**Try again**. If it stays, that is a bug: collect the two logs above.

## First run

1. Install, then wait for the window. It opens by itself. On a slow or
   Defender-heavy machine the first start can take a few minutes; the screen
   should say it is starting, and must never land on a token or password form.
   Closing the window and opening Daisy again must always bring a window back,
   even while the engine is still starting.
2. The setup wizard opens. Step through it without adding an AI model: use
   **Skip for now** on the AI brain screen.
3. The dashboard opens. The chat box is locked and says an AI brain is needed,
   with a button that opens the model page. Skills, Channels and Settings work.

## Adding an AI model

4. Settings → Model → add an OpenAI key. The button says "Checking your key…"
   and either connects or names the real problem (key rejected, no credit, no
   internet). It must never be a bare "LLM request failed". If the first model
   is not one your account can call, setup tries the next one and says which
   model it settled on rather than failing.
4a. The same holds for every provider on the list: Anthropic, Google, Groq and
   OpenRouter. With any one key alone, the model list is not empty, the
   composer chip shows one of that provider's models (never `openai/gpt-5.5`),
   and a chat message reaches that provider. The build gate proves this with
   invalid keys for all five; this step proves it with a real one.
4b. Type a model name that does not exist, then test it. The message must say
   Daisy does not know that model, and must not claim your account cannot use
   it.
5. Send "hello" in chat. A reply arrives.
6. Model Studio shows the provider by name (for example "LiteLLM", not
   "custom"), the model appears in the list immediately, and **Test connection**
   reports success.
7. With a custom server (LiteLLM, Ollama, LM Studio, vLLM), typing the server
   URL saves it under that product's name and lists its models. With the VPN
   off it still saves and says it could not reach the server.

## Channels

8. Channels → WhatsApp → **Show QR code**, on a fresh install where nothing has
   been configured. A QR image appears within a few seconds. It must not say
   "web login provider is not available".
9. Scan it with a phone. The page turns Connected.
10. Enabling or configuring a channel must not disconnect the app. If a change
    does need a restart, a message says so before it happens.

## Everyday use

11. While the dashboard window is open and you are chatting, no Windows
    notification appears for replies. Close the dashboard, send a message from
    WhatsApp, and a notification does appear; clicking it opens the dashboard,
    not the older-looking tray window.
11b. Hover a message you sent, click the pencil, change the text and press
    Enter. The editor is your own bubble (same width and look), with a hint
    line and "Cancel" / "Save and send". Your old question and its answer
    disappear only when the new answer starts. If the edit cannot be applied,
    your text stays in the editor with the reason under it; nothing vanishes.
12. The Workspace panel lists files with no red "Missing" badge, including
    `MEMORY.md`. This holds on a fresh install before the first chat, and again
    right after a reset.
12b. In the composer, the model chip says "Add an AI brain" until a provider is
    set up; it must never show a model name like `openai/gpt-5.5` on an install
    without a key.
13. Settings → "Something wrong?" → Create support report writes a zip and shows
    its path.

## Starting over

14. Settings → Start over → **Run setup again** reopens the wizard and keeps all
    data.
15. Settings → Start over → **Reset Daisy…** lists what is erased, requires the
    checkbox, then the red button. The app shows "Resetting Daisy…", comes back
    on its own and opens the setup wizard. Chats, keys and channels are gone; no
    login form appears. No command-prompt window flashes up during the restart.
    If the wizard shows a note that a few old files are still being removed,
    that is expected once; after the next restart the Workspace panel must show
    every file and the note must be gone.

## Uninstalling

Run this last, on a PC you are willing to wipe Daisy from. Do it twice: once
keeping your data, once deleting it.

16. With Daisy still running, start the uninstall from Windows Settings → Apps.
    The message must name Daisy and tell you to quit it from the icon near the
    clock. It must not say "Setup" or "DaisyClaw".
17. Quit Daisy, continue. The data question appears **first**, before anything
    is removed, and the highlighted button is **No** (keep). Nothing else
    interrupts after that.
18. Progress says what it is doing in plain words and never sits on one line
    for more than about a minute.
19. At the end a message says what happened. Keeping data must name the folder
    your conversations and keys were kept in.
20. Now check the machine is actually clean:
    - Task Manager → no `DaisyClaw.Tray.WinUI.exe` and no engine `node.exe`.
    - Task Scheduler → no **DaisyClaw Gateway** and no **Daisy Assistant** task.
    - `%LOCALAPPDATA%\DaisyAssistant` is gone.
    - Startup apps → no Daisy entry.
    - `%USERPROFILE%\.daisyclaw` is still there if you kept data, gone if you
      did not.
21. Reinstall after a "keep data" uninstall. Daisy opens with your chats, keys
    and channels intact, and no login form.
22. Failure drill, once per release: before uninstalling, rename
    `%LOCALAPPDATA%\DaisyAssistant\engine\Manage-DaisyGateway.ps1`, then
    uninstall. The **DaisyClaw Gateway** task must still be gone afterwards,
    and if anything could not be removed the final message names it and points
    at `%LOCALAPPDATA%\DaisyAssistant-uninstall.log`.
