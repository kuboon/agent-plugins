# Provenance

The skill in this directory is **not original to this repository**. It is
redistributed under the Apache License, Version 2.0, with one modification
recorded below.

| | |
| --- | --- |
| Upstream | [`gamedev-skills/awesome-gamedev-agent-skills`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) |
| Upstream path | `skills/disciplines/game-feel/` |
| Commit | `7110607ab816ece9669274bc84937857a8819796` |
| License | Apache-2.0 — see [`LICENSE`](LICENSE) |
| Attribution | Copyright 2026 Abhishek Barali and the awesome-gamedev-agent-skills contributors — see [`NOTICE`](NOTICE) |
| Modifications | **Yes** — see below. |

Only `.claude-plugin/plugin.json` and this file were added, to package the
skill for this marketplace; neither is upstream content.

## Modifications

Apache-2.0 section 4(b) requires modified files to carry prominent notices
stating that they were changed. Each file below carries such a notice, and the
full list of changes is:

- `skills/game-feel/SKILL.md` — removed the trailing `## Related skills`
  section. It listed sibling skills of the upstream 68-skill collection
  (`camera-systems`, `godot-animation`, `unity-animation`, `audio-design`,
  `physics-tuning`, `platformer`, `fps-shooter`, `roguelike`), none of which is
  distributed here, so every entry was a dead reference. No other change.

`skills/game-feel/references/feedback-recipes.md` is unmodified.

Note that the body still refers to `camera-systems`, `platformer` and
`audio-design` inline, in the "When to use" section's *when not to use* guidance
and in one Unity code comment. Those were left alone deliberately: they steer
the model away from applying this skill to the wrong problem, which is useful
advice whether or not the named skill is installed.

## Updating

Re-copy from upstream and update the commit above:

```bash
git clone --depth 1 https://github.com/gamedev-skills/awesome-gamedev-agent-skills /tmp/gd
rm -rf plugins/game-feel/skills/game-feel
cp -r /tmp/gd/skills/disciplines/game-feel plugins/game-feel/skills/game-feel
cp /tmp/gd/LICENSE /tmp/gd/NOTICE plugins/game-feel/
```

Re-copying overwrites the modification recorded above: re-apply it (or decide
it is no longer wanted) and keep the notice in the file consistent with this
page. Any further change needs the same treatment — a prominent notice in the
changed file per Apache-2.0 section 4(b), and an entry above.
