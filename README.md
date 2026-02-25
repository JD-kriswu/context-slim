# context-slim

L0/L1/L2 context optimization for LLM coding assistants.

## 原理

| 层级 | Token 量 | 内容 |
|------|----------|------|
| L0 | ~100 | 文件索引（一行一个文件） |
| L1 | ~2k | 结构摘要（类/方法签名） |
| L2 | 完整 | 源代码（按需加载） |

## 安装

```bash
cd context-slim
npm link
```

## 使用

```bash
# 初始化项目上下文
context-slim init /path/to/java/project

# 查询
context-slim query UserService

# 更新（文件变更后）
context-slim update /path/to/java/project

# Watch 模式（实时监听变化）
context-slim watch /path/to/java/project

# 安装 Git hook（commit 前自动更新）
context-slim hook /path/to/java/project
```

## 生成的文件

```
your-project/
├── .context/
│   ├── index.md              # L0: 全项目文件索引
│   ├── CLAUDE.md             # 给 Claude 的说明
│   └── src/main/java/
│       └── com/example/
│           └── _overview.md  # L1: 该目录的结构摘要
└── src/
    └── ...                   # L2: 原始源码
```

## 与 Claude Code 集成

将 `.context/CLAUDE.md` 的内容复制到项目根目录的 `CLAUDE.md`：

```markdown
## Context Structure

This project uses L0/L1/L2 context optimization.

- `.context/index.md` - L0: File index
- `.context/*/_overview.md` - L1: Structure summaries
- Source files - L2: Full code (load on demand)

When exploring the codebase:
1. Start with `.context/index.md` to find relevant files
2. Read `.context/<dir>/_overview.md` for structure
3. Only load full source when you need implementation details
```

## 支持的语言

- [x] Java
- [x] Go
- [x] TypeScript
- [x] JavaScript
- [ ] Python (planned)

## TODO

- [x] Watch 模式（实时监听）
- [x] Git pre-commit hook
- [x] 多语言支持
- [ ] 向量化搜索
- [ ] tree-sitter 精确解析
