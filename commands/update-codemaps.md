---
description: Обновить токен-экономные карты архитектуры проекта в codemaps/
---

# Update Codemaps

Analyze the codebase structure and update architecture documentation:

1. Detect the stack first (go.mod / package.json / composer.json / pubspec.yaml)
2. Scan source files for packages, imports, exports, and dependencies
   (skip vendor/, node_modules/, generated code)
3. Generate token-lean codemaps:
   - codemaps/architecture.md — overall architecture, module boundaries
   - codemaps/backend.md — backend structure (services, handlers, repositories)
   - codemaps/frontend.md — frontend structure (only if the project has one)
   - codemaps/data.md — data models, DB schemas, migrations overview
4. Calculate diff percentage from previous version
5. If changes > 30%, request user approval before updating
6. Add freshness timestamp to each codemap

Keep codemaps high-level: structure and relationships, not implementation
details. The goal is a map Claude can load instead of reading half the repo.
