---
summary: "Generated inventory of DaisyClaw plugins shipped in core, published externally, or kept source-only"
read_when:
  - You are deciding whether a plugin ships in the core npm package or installs separately
  - You are updating bundled plugin package metadata or release automation
  - You need the canonical internal vs external plugin list
title: "Plugin inventory"
---

# Plugin inventory

This page is generated from `extensions/*/package.json`, `daisyclaw.plugin.json`,
and the root npm package `files` exclusions. Regenerate it with:

```bash
pnpm plugins:inventory:gen
```

## Definitions

- **Core npm package:** built into the `daisyclaw` npm package and available without a separate plugin install.
- **Official external package:** DaisyClaw-maintained plugin omitted from the core npm package, kept in this official inventory, and installed on demand through ClawHub and/or npm.
- **Source checkout only:** repo-local plugin omitted from published npm artifacts and not advertised as an installable package.

Source checkouts are different from npm installs: after `pnpm install`, bundled
plugins load from `extensions/<id>` so local edits and package-local workspace
dependencies are available.

## Install a plugin

Use the install route in each entry to decide whether install is needed. Plugins
that say `included in DaisyClaw` are already present in the core package.
Official external packages need one install, then a Gateway restart.

For example, Discord is an official external package:

```bash
daisyclaw plugins install @daisyclaw/discord
daisyclaw gateway restart
daisyclaw plugins inspect discord --runtime --json
```

During the launch cutover, ordinary bare package specs still install from npm.
Use `clawhub:@daisyclaw/discord` or `npm:@daisyclaw/discord` when you need an
explicit source. After install, follow the plugin's setup doc, such as
[Discord](/channels/discord), to add credentials and channel config. See
[Manage plugins](/plugins/manage-plugins) for update, uninstall, and publishing
commands.

Each entry lists the package, distribution route, and description.

## Core npm package

90 plugins

- **[admin-http-rpc](/plugins/reference/admin-http-rpc)** (`@daisyclaw/admin-http-rpc`) - included in DaisyClaw. DaisyClaw admin HTTP RPC endpoint.

- **[alibaba](/plugins/reference/alibaba)** (`@daisyclaw/alibaba-provider`) - included in DaisyClaw. Adds video generation provider support.

- **[anthropic](/plugins/reference/anthropic)** (`@daisyclaw/anthropic-provider`) - included in DaisyClaw. Adds Anthropic model provider support to DaisyClaw.

- **[arcee](/plugins/reference/arcee)** (`@daisyclaw/arcee-provider`) - included in DaisyClaw. Adds Arcee model provider support to DaisyClaw.

- **[azure-speech](/plugins/reference/azure-speech)** (`@daisyclaw/azure-speech`) - included in DaisyClaw. Azure AI Speech text-to-speech (MP3, native Ogg/Opus voice notes, PCM telephony).

- **[bonjour](/plugins/reference/bonjour)** (`@daisyclaw/bonjour`) - included in DaisyClaw. Advertise the local DaisyClaw gateway over Bonjour/mDNS.

- **[browser](/plugins/reference/browser)** (`@daisyclaw/browser-plugin`) - included in DaisyClaw. Adds agent-callable tools.

- **[byteplus](/plugins/reference/byteplus)** (`@daisyclaw/byteplus-provider`) - included in DaisyClaw. Adds BytePlus, BytePlus Plan model provider support to DaisyClaw.

- **[canvas](/plugins/reference/canvas)** (`@daisyclaw/canvas-plugin`) - included in DaisyClaw. Experimental Canvas control and A2UI rendering surfaces for paired nodes.

- **[cerebras](/plugins/reference/cerebras)** (`@daisyclaw/cerebras-provider`) - included in DaisyClaw. Adds Cerebras model provider support to DaisyClaw.

- **[chutes](/plugins/reference/chutes)** (`@daisyclaw/chutes-provider`) - included in DaisyClaw. Adds Chutes model provider support to DaisyClaw.

- **[clickclack](/plugins/reference/clickclack)** (`@daisyclaw/clickclack`) - included in DaisyClaw. Adds the Clickclack channel surface for sending and receiving DaisyClaw messages.

- **[cloudflare-ai-gateway](/plugins/reference/cloudflare-ai-gateway)** (`@daisyclaw/cloudflare-ai-gateway-provider`) - included in DaisyClaw. Adds Cloudflare AI Gateway model provider support to DaisyClaw.

- **[codex-supervisor](/plugins/reference/codex-supervisor)** (`@daisyclaw/codex-supervisor`) - included in DaisyClaw. Supervise Codex app-server sessions from DaisyClaw.

- **[comfy](/plugins/reference/comfy)** (`@daisyclaw/comfy-provider`) - included in DaisyClaw. Adds ComfyUI model provider support to DaisyClaw.

- **[copilot-proxy](/plugins/reference/copilot-proxy)** (`@daisyclaw/copilot-proxy`) - included in DaisyClaw. Adds Copilot Proxy model provider support to DaisyClaw.

- **[deepgram](/plugins/reference/deepgram)** (`@daisyclaw/deepgram-provider`) - included in DaisyClaw. Adds media understanding provider support. Adds realtime transcription provider support.

- **[deepinfra](/plugins/reference/deepinfra)** (`@daisyclaw/deepinfra-provider`) - included in DaisyClaw. Adds DeepInfra model provider support to DaisyClaw.

- **[deepseek](/plugins/reference/deepseek)** (`@daisyclaw/deepseek-provider`) - included in DaisyClaw. Adds DeepSeek model provider support to DaisyClaw.

- **[document-extract](/plugins/reference/document-extract)** (`@daisyclaw/document-extract-plugin`) - included in DaisyClaw. Extract text and fallback page images from local document attachments.

- **[duckduckgo](/plugins/reference/duckduckgo)** (`@daisyclaw/duckduckgo-plugin`) - included in DaisyClaw. Adds web search provider support.

- **[elevenlabs](/plugins/reference/elevenlabs)** (`@daisyclaw/elevenlabs-speech`) - included in DaisyClaw. Adds media understanding provider support. Adds realtime transcription provider support. Adds text-to-speech provider support.

- **[exa](/plugins/reference/exa)** (`@daisyclaw/exa-plugin`) - included in DaisyClaw. Adds web search provider support.

- **[fal](/plugins/reference/fal)** (`@daisyclaw/fal-provider`) - included in DaisyClaw. Adds fal model provider support to DaisyClaw.

- **[file-transfer](/plugins/reference/file-transfer)** (`@daisyclaw/file-transfer`) - included in DaisyClaw. Fetch, list, and write files on paired nodes via dedicated node commands. Bypasses bash stdout truncation by using base64 over node.invoke for binaries up to 16 MB.

- **[firecrawl](/plugins/reference/firecrawl)** (`@daisyclaw/firecrawl-plugin`) - included in DaisyClaw. Adds agent-callable tools. Adds web fetch provider support. Adds web search provider support.

- **[fireworks](/plugins/reference/fireworks)** (`@daisyclaw/fireworks-provider`) - included in DaisyClaw. Adds Fireworks model provider support to DaisyClaw.

- **[github-copilot](/plugins/reference/github-copilot)** (`@daisyclaw/github-copilot-provider`) - included in DaisyClaw. Adds GitHub Copilot model provider support to DaisyClaw.

- **[gmi](/plugins/reference/gmi)** (`@daisyclaw/gmi-provider`) - included in DaisyClaw. Adds Gmi, Gmi Cloud, Gmicloud model provider support to DaisyClaw.

- **[google](/plugins/reference/google)** (`@daisyclaw/google-plugin`) - included in DaisyClaw. Adds Google, Google Gemini CLI, Google Vertex model provider support to DaisyClaw.

- **[gradium](/plugins/reference/gradium)** (`@daisyclaw/gradium-speech`) - included in DaisyClaw. Adds text-to-speech provider support.

- **[groq](/plugins/reference/groq)** (`@daisyclaw/groq-provider`) - included in DaisyClaw. Adds Groq model provider support to DaisyClaw.

- **[huggingface](/plugins/reference/huggingface)** (`@daisyclaw/huggingface-provider`) - included in DaisyClaw. Adds Hugging Face model provider support to DaisyClaw.

- **[imessage](/plugins/reference/imessage)** (`@daisyclaw/imessage`) - included in DaisyClaw. Adds the iMessage channel surface for sending and receiving DaisyClaw messages.

- **[inworld](/plugins/reference/inworld)** (`@daisyclaw/inworld-speech`) - included in DaisyClaw. Inworld streaming text-to-speech (MP3, OGG_OPUS, PCM telephony).

- **[irc](/plugins/reference/irc)** (`@daisyclaw/irc`) - included in DaisyClaw. Adds the IRC channel surface for sending and receiving DaisyClaw messages.

- **[kilocode](/plugins/reference/kilocode)** (`@daisyclaw/kilocode-provider`) - included in DaisyClaw. Adds Kilocode model provider support to DaisyClaw.

- **[kimi](/plugins/reference/kimi)** (`@daisyclaw/kimi-provider`) - included in DaisyClaw. Adds Kimi, Kimi Coding model provider support to DaisyClaw.

- **[litellm](/plugins/reference/litellm)** (`@daisyclaw/litellm-provider`) - included in DaisyClaw. Adds LiteLLM model provider support to DaisyClaw.

- **[llm-task](/plugins/reference/llm-task)** (`@daisyclaw/llm-task`) - included in DaisyClaw. Generic JSON-only LLM tool for structured tasks callable from workflows.

- **[lmstudio](/plugins/reference/lmstudio)** (`@daisyclaw/lmstudio-provider`) - included in DaisyClaw. Adds LM Studio model provider support to DaisyClaw.

- **[mattermost](/plugins/reference/mattermost)** (`@daisyclaw/mattermost`) - included in DaisyClaw. Adds the Mattermost channel surface for sending and receiving DaisyClaw messages.

- **[memory-core](/plugins/reference/memory-core)** (`@daisyclaw/memory-core`) - included in DaisyClaw. Adds agent-callable tools.

- **[memory-wiki](/plugins/reference/memory-wiki)** (`@daisyclaw/memory-wiki`) - included in DaisyClaw. Persistent wiki compiler and Obsidian-friendly knowledge vault for DaisyClaw.

- **[microsoft](/plugins/reference/microsoft)** (`@daisyclaw/microsoft-speech`) - included in DaisyClaw. Adds text-to-speech provider support.

- **[microsoft-foundry](/plugins/reference/microsoft-foundry)** (`@daisyclaw/microsoft-foundry`) - included in DaisyClaw. Adds Microsoft Foundry model provider support to DaisyClaw.

- **[migrate-claude](/plugins/reference/migrate-claude)** (`@daisyclaw/migrate-claude`) - included in DaisyClaw. Imports Claude Code and Claude Desktop instructions, MCP servers, skills, and safe configuration into DaisyClaw.

- **[migrate-hermes](/plugins/reference/migrate-hermes)** (`@daisyclaw/migrate-hermes`) - included in DaisyClaw. Imports Hermes configuration, memories, skills, and supported credentials into DaisyClaw.

- **[minimax](/plugins/reference/minimax)** (`@daisyclaw/minimax-provider`) - included in DaisyClaw. Adds MiniMax, MiniMax Portal model provider support to DaisyClaw.

- **[mistral](/plugins/reference/mistral)** (`@daisyclaw/mistral-provider`) - included in DaisyClaw. Adds Mistral model provider support to DaisyClaw.

- **[moonshot](/plugins/reference/moonshot)** (`@daisyclaw/moonshot-provider`) - included in DaisyClaw. Adds Moonshot model provider support to DaisyClaw.

- **[novita](/plugins/reference/novita)** (`@daisyclaw/novita-provider`) - included in DaisyClaw. Adds Novita, Novita AI, Novitaai model provider support to DaisyClaw.

- **[nvidia](/plugins/reference/nvidia)** (`@daisyclaw/nvidia-provider`) - included in DaisyClaw. Adds NVIDIA model provider support to DaisyClaw.

- **[oc-path](/plugins/reference/oc-path)** (`@daisyclaw/oc-path`) - included in DaisyClaw. Adds the daisyclaw path CLI for oc:// workspace file addressing.

- **[ollama](/plugins/reference/ollama)** (`@daisyclaw/ollama-provider`) - included in DaisyClaw. Adds Ollama, Ollama Cloud model provider support to DaisyClaw.

- **[open-prose](/plugins/reference/open-prose)** (`@daisyclaw/open-prose`) - included in DaisyClaw. OpenProse VM skill pack with a /prose slash command.

- **[openai](/plugins/reference/openai)** (`@daisyclaw/openai-provider`) - included in DaisyClaw. Adds OpenAI model provider support to DaisyClaw.

- **[opencode](/plugins/reference/opencode)** (`@daisyclaw/opencode-provider`) - included in DaisyClaw. Adds OpenCode model provider support to DaisyClaw.

- **[opencode-go](/plugins/reference/opencode-go)** (`@daisyclaw/opencode-go-provider`) - included in DaisyClaw. Adds OpenCode Go model provider support to DaisyClaw.

- **[openrouter](/plugins/reference/openrouter)** (`@daisyclaw/openrouter-provider`) - included in DaisyClaw. Adds OpenRouter model provider support to DaisyClaw.

- **[parallel](/tools/parallel-search)** (`@daisyclaw/parallel-plugin`) - included in DaisyClaw. Adds web search provider support.

- **[perplexity](/plugins/reference/perplexity)** (`@daisyclaw/perplexity-plugin`) - included in DaisyClaw. Adds web search provider support.

- **[policy](/plugins/reference/policy)** (`@daisyclaw/policy`) - included in DaisyClaw. Adds policy-backed doctor checks for workspace conformance.

- **[qianfan](/plugins/reference/qianfan)** (`@daisyclaw/qianfan-provider`) - included in DaisyClaw. Adds Qianfan model provider support to DaisyClaw.

- **[qwen](/plugins/reference/qwen)** (`@daisyclaw/qwen-provider`) - included in DaisyClaw. Adds Qwen, Qwen Cloud, Model Studio, DashScope, Qwen Oauth, Qwen Portal, Qwen CLI model provider support to DaisyClaw.

- **[runway](/plugins/reference/runway)** (`@daisyclaw/runway-provider`) - included in DaisyClaw. Adds video generation provider support.

- **[searxng](/plugins/reference/searxng)** (`@daisyclaw/searxng-plugin`) - included in DaisyClaw. Adds web search provider support.

- **[senseaudio](/plugins/reference/senseaudio)** (`@daisyclaw/senseaudio-provider`) - included in DaisyClaw. Adds media understanding provider support.

- **[sglang](/plugins/reference/sglang)** (`@daisyclaw/sglang-provider`) - included in DaisyClaw. Adds SGLang model provider support to DaisyClaw.

- **[signal](/plugins/reference/signal)** (`@daisyclaw/signal`) - included in DaisyClaw. Adds the Signal channel surface for sending and receiving DaisyClaw messages.

- **[sms](/plugins/reference/sms)** (`@daisyclaw/sms`) - included in DaisyClaw. Twilio SMS channel plugin for DaisyClaw text messages.

- **[stepfun](/plugins/reference/stepfun)** (`@daisyclaw/stepfun-provider`) - included in DaisyClaw. Adds StepFun, StepFun Plan model provider support to DaisyClaw.

- **[synthetic](/plugins/reference/synthetic)** (`@daisyclaw/synthetic-provider`) - included in DaisyClaw. Adds Synthetic model provider support to DaisyClaw.

- **[tavily](/plugins/reference/tavily)** (`@daisyclaw/tavily-plugin`) - included in DaisyClaw. Adds agent-callable tools. Adds web search provider support.

- **[telegram](/plugins/reference/telegram)** (`@daisyclaw/telegram`) - included in DaisyClaw. Adds the Telegram channel surface for sending and receiving DaisyClaw messages.

- **[tencent](/plugins/reference/tencent)** (`@daisyclaw/tencent-provider`) - included in DaisyClaw. Adds Tencent TokenHub model provider support to DaisyClaw.

- **[together](/plugins/reference/together)** (`@daisyclaw/together-provider`) - included in DaisyClaw. Adds Together model provider support to DaisyClaw.

- **[tts-local-cli](/plugins/reference/tts-local-cli)** (`@daisyclaw/tts-local-cli`) - included in DaisyClaw. Adds text-to-speech provider support.

- **[venice](/plugins/reference/venice)** (`@daisyclaw/venice-provider`) - included in DaisyClaw. Adds Venice model provider support to DaisyClaw.

- **[vercel-ai-gateway](/plugins/reference/vercel-ai-gateway)** (`@daisyclaw/vercel-ai-gateway-provider`) - included in DaisyClaw. Adds Vercel AI Gateway model provider support to DaisyClaw.

- **[vllm](/plugins/reference/vllm)** (`@daisyclaw/vllm-provider`) - included in DaisyClaw. Adds vLLM model provider support to DaisyClaw.

- **[volcengine](/plugins/reference/volcengine)** (`@daisyclaw/volcengine-provider`) - included in DaisyClaw. Adds Volcengine, Volcengine Plan model provider support to DaisyClaw.

- **[voyage](/plugins/reference/voyage)** (`@daisyclaw/voyage-provider`) - included in DaisyClaw. Adds memory embedding provider support.

- **[vydra](/plugins/reference/vydra)** (`@daisyclaw/vydra-provider`) - included in DaisyClaw. Adds Vydra model provider support to DaisyClaw.

- **[web-readability](/plugins/reference/web-readability)** (`@daisyclaw/web-readability-plugin`) - included in DaisyClaw. Extract readable article content from local HTML web fetch responses.

- **[webhooks](/plugins/reference/webhooks)** (`@daisyclaw/webhooks`) - included in DaisyClaw. Authenticated inbound webhooks that bind external automation to DaisyClaw TaskFlows.

- **[workboard](/plugins/reference/workboard)** (`@daisyclaw/workboard`) - included in DaisyClaw. Dashboard workboard for agent-owned issues and sessions.

- **[xai](/plugins/reference/xai)** (`@daisyclaw/xai-plugin`) - included in DaisyClaw. Adds xAI model provider support to DaisyClaw.

- **[xiaomi](/plugins/reference/xiaomi)** (`@daisyclaw/xiaomi-provider`) - included in DaisyClaw. Adds Xiaomi, Xiaomi Token Plan model provider support to DaisyClaw.

- **[zai](/plugins/reference/zai)** (`@daisyclaw/zai-provider`) - included in DaisyClaw. Adds Z.AI model provider support to DaisyClaw.

## Official external packages

35 plugins

- **[acpx](/plugins/reference/acpx)** (`@daisyclaw/acpx`) - npm; ClawHub. DaisyClaw ACP runtime backend with plugin-owned session and transport management.

- **[amazon-bedrock](/plugins/reference/amazon-bedrock)** (`@daisyclaw/amazon-bedrock-provider`) - npm; ClawHub. DaisyClaw Amazon Bedrock provider plugin with model discovery, embeddings, and guardrail support.

- **[amazon-bedrock-mantle](/plugins/reference/amazon-bedrock-mantle)** (`@daisyclaw/amazon-bedrock-mantle-provider`) - npm; ClawHub. DaisyClaw Amazon Bedrock Mantle provider plugin for OpenAI-compatible model routing.

- **[anthropic-vertex](/plugins/reference/anthropic-vertex)** (`@daisyclaw/anthropic-vertex-provider`) - npm; ClawHub. DaisyClaw Anthropic Vertex provider plugin for Claude models on Google Vertex AI.

- **[brave](/plugins/reference/brave)** (`@daisyclaw/brave-plugin`) - npm; ClawHub. DaisyClaw Brave Search provider plugin for web search.

- **[codex](/plugins/reference/codex)** (`@daisyclaw/codex`) - npm; ClawHub. DaisyClaw Codex app-server harness and model provider plugin with a Codex-managed GPT catalog.

- **[copilot](/plugins/reference/copilot)** (`@daisyclaw/copilot`) - npm; ClawHub: `clawhub:@daisyclaw/copilot`. Registers the GitHub Copilot agent runtime.

- **[diagnostics-otel](/plugins/reference/diagnostics-otel)** (`@daisyclaw/diagnostics-otel`) - npm; ClawHub: `clawhub:@daisyclaw/diagnostics-otel`. DaisyClaw diagnostics OpenTelemetry exporter for metrics and traces.

- **[diagnostics-prometheus](/plugins/reference/diagnostics-prometheus)** (`@daisyclaw/diagnostics-prometheus`) - npm; ClawHub: `clawhub:@daisyclaw/diagnostics-prometheus`. DaisyClaw diagnostics Prometheus exporter for runtime metrics.

- **[diffs](/plugins/reference/diffs)** (`@daisyclaw/diffs`) - npm; ClawHub. DaisyClaw read-only diff viewer plugin and file renderer for agents.

- **[diffs-language-pack](/plugins/reference/diffs-language-pack)** (`@daisyclaw/diffs-language-pack`) - npm; ClawHub: `clawhub:@daisyclaw/diffs-language-pack`. Adds syntax highlighting for languages outside the default diffs viewer set.

- **[discord](/plugins/reference/discord)** (`@daisyclaw/discord`) - npm; ClawHub. DaisyClaw Discord channel plugin for channels, DMs, commands, and app events.

- **[feishu](/plugins/reference/feishu)** (`@daisyclaw/feishu`) - npm; ClawHub. DaisyClaw Feishu/Lark channel plugin for chats and workplace tools (community maintained by @m1heng).

- **[google-meet](/plugins/reference/google-meet)** (`@daisyclaw/google-meet`) - npm; ClawHub. DaisyClaw Google Meet participant plugin for joining calls through Chrome or Twilio transports.

- **[googlechat](/plugins/reference/googlechat)** (`@daisyclaw/googlechat`) - npm; ClawHub. DaisyClaw Google Chat channel plugin for spaces and direct messages.

- **[line](/plugins/reference/line)** (`@daisyclaw/line`) - npm; ClawHub. DaisyClaw LINE channel plugin for LINE Bot API chats.

- **[llama-cpp](/plugins/reference/llama-cpp)** (`@daisyclaw/llama-cpp-provider`) - npm; ClawHub. Local GGUF embeddings through node-llama-cpp.

- **[lobster](/plugins/reference/lobster)** (`@daisyclaw/lobster`) - npm; ClawHub. Lobster workflow tool plugin for typed pipelines and resumable approvals.

- **[matrix](/plugins/reference/matrix)** (`@daisyclaw/matrix`) - ClawHub: `clawhub:@daisyclaw/matrix`; npm. DaisyClaw Matrix channel plugin for rooms and direct messages.

- **[memory-lancedb](/plugins/reference/memory-lancedb)** (`@daisyclaw/memory-lancedb`) - npm; ClawHub. DaisyClaw LanceDB-backed long-term memory plugin with auto-recall, auto-capture, and vector search.

- **[msteams](/plugins/reference/msteams)** (`@daisyclaw/msteams`) - npm; ClawHub. DaisyClaw Microsoft Teams channel plugin for bot conversations.

- **[nextcloud-talk](/plugins/reference/nextcloud-talk)** (`@daisyclaw/nextcloud-talk`) - npm; ClawHub. DaisyClaw Nextcloud Talk channel plugin for conversations.

- **[nostr](/plugins/reference/nostr)** (`@daisyclaw/nostr`) - npm; ClawHub. DaisyClaw Nostr channel plugin for NIP-04 encrypted direct messages.

- **[openshell](/plugins/reference/openshell)** (`@daisyclaw/openshell-sandbox`) - npm; ClawHub. DaisyClaw sandbox backend for the NVIDIA OpenShell CLI with mirrored local workspaces and SSH command execution.

- **[pixverse](/plugins/reference/pixverse)** (`@daisyclaw/pixverse-provider`) - npm; ClawHub: `clawhub:@daisyclaw/pixverse-provider`. DaisyClaw PixVerse video generation provider plugin.

- **[qqbot](/plugins/reference/qqbot)** (`@daisyclaw/qqbot`) - npm; ClawHub. DaisyClaw QQ Bot channel plugin for group and direct-message workflows.

- **[slack](/plugins/reference/slack)** (`@daisyclaw/slack`) - npm; ClawHub. DaisyClaw Slack channel plugin for channels, DMs, commands, and app events.

- **[synology-chat](/plugins/reference/synology-chat)** (`@daisyclaw/synology-chat`) - npm; ClawHub. Synology Chat channel plugin for DaisyClaw channels and direct messages.

- **[tlon](/plugins/reference/tlon)** (`@daisyclaw/tlon`) - npm; ClawHub. DaisyClaw Tlon/Urbit channel plugin for chat workflows.

- **[tokenjuice](/plugins/reference/tokenjuice)** (`@daisyclaw/tokenjuice`) - npm; ClawHub: `clawhub:@daisyclaw/tokenjuice`. Compacts exec and bash tool results with tokenjuice reducers.

- **[twitch](/plugins/reference/twitch)** (`@daisyclaw/twitch`) - npm; ClawHub. DaisyClaw Twitch channel plugin for chat and moderation workflows.

- **[voice-call](/plugins/reference/voice-call)** (`@daisyclaw/voice-call`) - npm; ClawHub. DaisyClaw voice-call plugin for Twilio, Telnyx, and Plivo phone calls.

- **[whatsapp](/plugins/reference/whatsapp)** (`@daisyclaw/whatsapp`) - ClawHub: `clawhub:@daisyclaw/whatsapp`; npm. DaisyClaw WhatsApp channel plugin for WhatsApp Web chats.

- **[zalo](/plugins/reference/zalo)** (`@daisyclaw/zalo`) - npm; ClawHub. DaisyClaw Zalo channel plugin for bot and webhook chats.

- **[zalouser](/plugins/reference/zalouser)** (`@daisyclaw/zalouser`) - npm; ClawHub. DaisyClaw Zalo Personal Account plugin via native zca-js integration.

## Source checkout only

3 plugins

- **[qa-channel](/plugins/reference/qa-channel)** (`@daisyclaw/qa-channel`) - source checkout only. Adds the QA Channel surface for sending and receiving DaisyClaw messages.

- **[qa-lab](/plugins/reference/qa-lab)** (`@daisyclaw/qa-lab`) - source checkout only. DaisyClaw QA lab plugin with private debugger UI and scenario runner.

- **[qa-matrix](/plugins/reference/qa-matrix)** (`@daisyclaw/qa-matrix`) - source checkout only. Matrix QA transport runner and substrate.
