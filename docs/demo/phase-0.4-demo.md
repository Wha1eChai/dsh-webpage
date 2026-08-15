# Phase 0.4 five-minute demo

Audience: someone who already has DSH `0.1.0-rc.6` and the web profile with Webpage, Jobs, Usage, and Automations installed. Do **not** install `examples/crash-app` into the standing profile; add it only for the crash beat, then remove it.

Target runtime: `dsh web --port 11350`.

## Beat sheet

| t | Action | What the audience should see |
| --- | --- | --- |
| 0:00 | Open the launch panel from sidebar Apps | Switcher lists Inspector, Jobs, Usage, Automations. No store, no badges. |
| 0:40 | Open Usage | Side panel. Conversation stays visible. Session / job / live counts. |
| 1:20 | Deep-link | Paste `/apps/wha1echai.usage`. Same panel, same conversation node. |
| 2:00 | Open Automations | Side panel. If titanwings Host is absent: install hint. If present: pause / resume / Run now. |
| 2:40 | Crash beat | Temporarily add crash-app. Open `/apps/wha1echai.crash`. Body says App crashed + Retry. Chrome, conversation, and Usage stay up. Close the window. |
| 3:40 | Uninstall | Remove crash-app (and optionally Usage). Relaunch. The launcher row is gone. Nothing else breaks. |
| 4:20 | Close | One sentence: Webpage is a windowing system. Markets install plugins. A crashed App is a closed window. |

## GIF shot list

1. Sidebar Apps → launch panel with four product rows (no crash-app).
2. Click Usage → panel chrome, conversation still in frame.
3. Address bar `/apps/wha1echai.usage` reload.
4. Click Automations → either the Host-missing empty or a live list.
5. Crash-app open: crashed heading, Retry, Close app; conversation box unchanged.
6. After uninstall: launch panel without the removed row.

## Spoken line

「启动器只列已经 `register()` 的 App。用量是本机活动，不是供应商账单。定时任务的调度在 titanwings Host 里，这个 App 只是窗口。崩掉的 App 只是关掉的窗口。」
