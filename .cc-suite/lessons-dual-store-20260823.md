# 双库调查经验复盘（2026-08-23）

> 这是一次「方向性决策反复搞反」的完整复盘。触发：用户在调查「会话双库」问题时，两次要求「grill yourself to improve, not to tear yourself down」。

---

## 一句话核心

在「以哪个为主」的方向性决策上，我曾用「我推断你该怎样」替代「听你说了什么」，反复搞反了两次。根子：**先查运行时证据，先听用户明确说的话，绝不自己推断后直接下结论。**

---

## 一、背景：双库分裂是怎么来的

用户的 Claude Code 环境存在两套「接入 DeepSeek 模型」的方案，导致会话散落在两个库：

| 方案 | 机制 | 库 |
|------|------|-----|
| cc-switch | 改写 `~/.claude/settings.json` 的 env（`ANTHROPIC_BASE_URL` 等）| vanilla（`~/.claude`）|
| claude-deepseek 脚本 | `CLAUDE_CONFIG_DIR=~/.claude-deepseek` + 读 credentials.sh | deepseek（`~/.claude-deepseek`）|

关键混淆点：**两个库都用 deepseek 模型**，「用 deepseek 模型」和「用哪个库」是两个正交的维度。

`.bashrc` 里 `claude()` 函数把 `claude` 命令指向 `claude-deepseek` 脚本，导致：
- 敲 `claude` / 点桌面快捷方式 → deepseek 库
- 只有 `command claude` / 完整路径 → vanilla 库（例外入口）

用户正常打开方式一直是 deepseek 库。而当前会话因为用了 `command claude -c`（例外路径）落到了 vanilla，制造了「当前在 vanilla」的假象。

---

## 二、我犯的四个错

### 错误 1：类别错误（category error）

把「模型」（用哪个 AI）和「库」（会话存哪个目录）两个正交维度混为一谈，把「用了 deepseek 模型」错误推成「该用 deepseek 库」。

**正确**：先问「这两个东西是不是同一维度」，模型 vs 库是不同维度。

### 错误 2：把推断当事实

把「用户习惯 cc-switch → vanilla 库」这个**未经证实的推断**，当成「已查实」写进给 Codex 的 prompt。结果 Codex 也顺着它得出「vanilla 为主」，结论链从源头被污染。

**正确**：给 AI（Codex 等）的 prompt 不掺入未经证实的推断；找不到证据就明说「这是推测」。

### 错误 3：把实然当应然

把「当前会话恰好在 vanilla 库」（实然，因为用了 `command claude` 这个偶然命令）当成「应该用 vanilla 库」（应然，方向性决策）。

**正确**：区分「事实是什么」和「应该选什么」。前者靠查证，后者靠用户拍板。

### 错误 4：忽略用户明确表达

用户两次明确说「走 deepseek 库」「正常开发应该走 deepseek 库」，我却用「模型≠库」去纠正，把用户的明确倾向降级成「你记混了」。第三次查证才发现用户一直是对的。

**正确**：判断「用户想要什么」，优先听用户明确说的话，而非我的推断。

---

## 三、正确的四步（方法论）

1. **判断「实际在用什么」** → 查**运行时证据**（`/proc/<pid>/environ` 里的 `CLAUDE_CONFIG_DIR`、真实读写位置），不只看静态配置（bashrc 函数、脚本）。
2. **判断「用户想要什么」** → **优先听用户明确说的话**，而非我的推断；方向性、有持久影响的决策先问用户。
3. **遇到「两个相似的东西」** → 先问**是不是同一维度**（模型 vs 库、入口 vs 存储、实然 vs 应然）。
4. **给 AI 的 prompt 不掺入未经证实的推断**，否则结论从源头被污染；历史 memory/结论要独立验证（之前的会话、之前的自己同样会犯错）。

---

## 四、技术速查（本项目双库规律，已查实）

### 打开方式 → 库（统一后）

| 打开方式 | 进的库 |
|---------|--------|
| `claude` | deepseek |
| `command claude` | deepseek（已统一）|
| 完整路径 `~/.npm-global/bin/claude` | deepseek（已统一）|
| 桌面快捷方式（resume-claude.sh）| deepseek |

### 最终状态

- **主库 = deepseek**（`~/.claude-deepseek`），用户的日常用法
- **vanilla 库** = 只剩当前会话（9451987d）这个遗留，关机后迁走归档
- **统一手段**：`.bashrc` 加 `export CLAUDE_CONFIG_DIR="$HOME/.claude-deepseek"`

### 验证命令

```bash
# 看当前会话进程在哪个库（运行时证据，最准）
tr '\0' '\n' < /proc/<pid>/environ | grep CLAUDE_CONFIG_DIR

# 模拟交互式 shell，看 claude 解析成什么
bash -ic 'type claude; echo $CLAUDE_CONFIG_DIR'
```

---

## 五、复盘记录

- 第一次 grill：触及「类别错误、用静态配置推断运行时、不独立验证历史结论」。
- 第二次 grill：触及更深的「把推断当事实、实然当应然、污染了 Codex 的 prompt、忽略用户明确表达」。

**最终纠正**：以 deepseek 库为主（与用户实际用法一致），已统一入口 + 更新 memory。

---

## 关联

- 持久记忆：`~/.claude-deepseek/projects/-home-haibo-projects-led-webhub/memory/methodology-dual-store-lessons.md`
- 双库机制：`~/.claude-deepseek/projects/-home-haibo-projects-led-webhub/memory/claude-session-stores-and-desktop-shortcuts.md`
