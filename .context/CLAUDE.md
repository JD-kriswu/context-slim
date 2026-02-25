## Context Structure

This project uses L0/L1/L2 context optimization.

- `.context/index.md` - L0: File index (one-liner per file)
- `.context/*/_overview.md` - L1: Structure summaries (signatures only)
- Source files - L2: Full code (load on demand)

When exploring the codebase:
1. Start with `.context/index.md` to find relevant files
2. Read `.context/<dir>/_overview.md` for structure
3. Only load full source when you need implementation details