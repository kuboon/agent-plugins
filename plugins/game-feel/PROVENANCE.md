# Provenance

The skill in this directory is **not original to this repository**. It is
redistributed verbatim under the Apache License, Version 2.0.

| | |
| --- | --- |
| Upstream | [`gamedev-skills/awesome-gamedev-agent-skills`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) |
| Upstream path | `skills/disciplines/game-feel/` |
| Commit | `7110607ab816ece9669274bc84937857a8819796` |
| License | Apache-2.0 — see [`LICENSE`](LICENSE) |
| Attribution | Copyright 2026 Abhishek Barali and the awesome-gamedev-agent-skills contributors — see [`NOTICE`](NOTICE) |
| Modifications | **None.** `skills/game-feel/` is a byte-for-byte copy of the upstream directory. |

Only `.claude-plugin/plugin.json` and this file were added, to package the
skill for this marketplace; neither is upstream content.

## Updating

Re-copy from upstream and update the commit above:

```bash
git clone --depth 1 https://github.com/gamedev-skills/awesome-gamedev-agent-skills /tmp/gd
rm -rf plugins/game-feel/skills/game-feel
cp -r /tmp/gd/skills/disciplines/game-feel plugins/game-feel/skills/game-feel
cp /tmp/gd/LICENSE /tmp/gd/NOTICE plugins/game-feel/
```

If the copy is ever modified, Apache-2.0 section 4(b) requires the changed files
to carry prominent notices stating that they were changed — record the change
here and in the file itself, and drop the "Modifications: none" claim above.
