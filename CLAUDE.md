# Agent Behavior Rules

## Communication

- Work silently. Do not narrate steps or explain file by file what you are doing.
- Only write to the user when: blocked, facing a risky or destructive decision, encountering secrets/credentials, or about to perform a store upload or build signing action.
- When the task is complete, give a short final report in Turkish covering: files created/changed, what was added, and any risks.

## JellyChainRush Project Rules

- Do not modify localization/language files or the language selector.
- Do not break the save/backup system.
- Work within the Phaser / Vite / Capacitor project structure.
- Avoid large unnecessary refactors; make small, targeted changes.
- Do not scan heavy directories: `node_modules`, `dist`, `android/build`.
