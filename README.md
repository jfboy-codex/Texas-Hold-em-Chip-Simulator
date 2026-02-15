# 德州扑克筹码模拟器（微信小程序）

这是一个基于微信小程序的德州扑克筹码模拟器原型，实现了：

- 微信账号登录并设置头像/昵称
- 房主创建房间（初始筹码、盲注、玩家顺序）
- 邀请码加入房间（支持二维码数据文本）
- 房间内查看筹码、下注动作（Check / Raise / Fold）
- 筹码点击加注、像素风简易动画（下注与收池）
- 回合结束后由房主选择获胜者，支持平分底池与 All-in 封顶收益

> 说明：本仓库为前端原型，使用本地 `storage` 模拟后端房间数据。

## 目录结构

```text
.
├── app.js
├── app.json
├── app.wxss
├── pages
│   ├── login
│   ├── room-create
│   ├── room-join
│   └── room-table
└── utils
    ├── poker.js
    └── store.js
```

## 快速开始

1. 使用微信开发者工具导入项目目录。
2. 在 `详情 -> 本地设置` 中勾选“不校验合法域名”。
3. 编译运行后，从登录页进入创建/加入房间流程。

## 关键规则实现

- `utils/poker.js#createSidePots`：根据各玩家本轮总投入构造边池
- `utils/poker.js#settleByWinners`：按获胜者分配主池/边池
  - 若出现 All-in，赢家收益由其可参与的池子封顶，不会超过等额可赢范围



## CE-RJSSP 调度实验（新增）

仓库新增了 `experiments/` 目录，用于复现实验方法中的 CE-RJSSP（可重入 + 柔性机台 + 多目标）调度实验与绘图。

快速运行：

```bash
python experiments/run_experiments.py --num-instances 12 --jobs 10 --machines 10
```

结果会输出到 `experiments/results/`，包括策略对比、消融实验、泛化实验以及对应图表。
