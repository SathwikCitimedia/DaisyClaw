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
12. The Workspace panel lists files with no red "Missing" badge, including
    `MEMORY.md`.
13. Settings → "Something wrong?" → Create support report writes a zip and shows
    its path.

## Starting over

14. Settings → Start over → **Run setup again** reopens the wizard and keeps all
    data.
15. Settings → Start over → **Reset Daisy…** lists what is erased, requires the
    checkbox, then the red button. The app shows "Resetting Daisy…", comes back
    on its own and opens the setup wizard. Chats, keys and channels are gone; no
    login form appears.
