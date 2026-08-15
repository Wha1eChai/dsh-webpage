# Phase 0.5 five-minute demo

Audience: someone who already has DSH `0.1.0-rc.6` and the web profile with Webpage + Usage installed. Jobs App and Automations App are **not** in this profile. Do **not** install `examples/crash-app` into the standing profile.

Target runtime: `dsh web --port 11350`.

## Beat sheet

| t | Action | What the audience should see |
| --- | --- | --- |
| 0:00 | Open the launch panel from sidebar Apps | Switcher lists Inspector and Usage. No Jobs. No Automations. No store. |
| 0:40 | Open Usage | Side panel. Month heatmap with day cells. Conversation stays visible. |
| 1:20 | Click a day | Day detail: token total, model rows and/or empty copy. |
| 2:00 | Scroll to provider cards | Four balance cards. Missing keys show `missing`, not a crash. Subscription cards for OpenCode Go and Z.ai. |
| 2:40 | Deep-link | Paste `/apps/wha1echai.usage`. Same panel. Escape closes it. |
| 3:20 | Honesty line | Heatmap is local session tokens. Balances are Host-proxied. Keys never reach the browser. |
| 4:00 | Close | Webpage is a windowing system. Usage is the flagship App this phase. Automations wait for a trigger → agent-loop recipe ([ADR 0007](../adr/0007-automations-are-trigger-to-agent-loop.md)). |

## GIF shot list

1. Sidebar Apps → launch panel with Inspector + Usage only.
2. Click Usage → heatmap cells, conversation still in frame.
3. Click a day → detail list.
4. Provider cards with at least one `data-status="missing"`.
5. Address bar `/apps/wha1echai.usage` reload.

## Spoken line

「热图是本机会话折出来的 token。余额是 Host 代查的供应商账户。定时任务先不做——三家对过了，单独 cron 没有产品价值。」
