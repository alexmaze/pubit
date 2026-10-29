package pubit

import "embed"

//go:embed all:web/dist
var WebDist embed.FS

//go:embed skill/SKILL.md
var SkillMD string
