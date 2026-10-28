# Connect 4 vs AI

一个可直接打开的网页版四子棋游戏。玩家执红棋，AI 执黄棋，支持 Easy、Medium、Hard 三种难度。

## 项目文件

```text
connect-4/
├── index.html    # 页面结构（开始界面 + 游戏界面）
├── styles.css    # 页面与棋盘的视觉样式
├── script.js     # 游戏规则、交互与 AI 搜索逻辑
└── README.md
```

> 原项目中的 `README.md` 内容实际上是 JavaScript 代码，并且页面引用了不存在的 `script.js`，所以棋盘无法显示、New Game 也无法工作。本版本已将这些逻辑整理到正确的 `script.js` 中。

## 如何运行

最简单的方式：直接双击 `index.html`。

如果浏览器限制本地文件，也可以在项目目录运行一个本地服务器：

```bash
python -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 玩法

1. 在 Difficulty 下拉框中选择 `Easy`、`Medium` 或 `Hard`。
2. 点击 **New Game**（或 **Start Playing**）进入棋盘。
3. 点击任意一列，把红色棋子放入该列最底部的位置。
4. 玩家与 AI 轮流落子。任意方向先连成四子的一方获胜。
5. 游戏结束后，点击 **New Game** 立即开始下一局。

## 三种 AI 难度

| 难度 | AI 行为 |
| --- | --- |
| Easy | 大多随机落子，只偶尔抓住胜利或阻挡玩家，适合轻松练习。 |
| Medium | 使用 3 层 Minimax 搜索；一定会抓住直接胜利，也会阻挡玩家的直接四连。 |
| Hard | 使用 5 层 Minimax 搜索和 Alpha-Beta 剪枝，会规划多步攻势并更积极防守。 |

## 已实现的功能

- 可交互的 6 × 7 棋盘，按列落子，支持鼠标与键盘操作。
- New Game 会从开始界面进入游戏，或在游戏中立即重置棋局。
- 三种 AI 难度，切换后立即生效。
- 胜负检测，获胜的四颗棋子会高亮显示。
- 平局检测、AI 思考状态、重新开始时的计时器清理。
- 响应式布局和键盘焦点样式。
- 已移除原来的 Player / Draws / AI 记分方框及相关计分代码，界面更简洁。

## 可调整的地方

如果想调整 Hard 的强度，可修改 `script.js` 中：

```js
const searchDepth = difficulty === "hard" ? 5 : 3;
```

把 `5` 改大（例如 `6`）会让 AI 看得更远，但思考时间也会增加；改小则会降低难度。
