# CE-RJSSP 实验模块

该目录实现了一个可运行的**约束增强可重入半导体调度（CE-RJSSP）**实验框架，包含：

- 实例生成（重入、柔性机台、序列相关换型、维护窗口、故障扰动、交期）
- 多目标评估（Makespan / Tardiness / Energy / WIP）
- 基线策略（FIFO/SPT/LPT/MWKR/ATC/Random）
- G4DQN 风格策略（候选集、掩码可行域、多目标打分、启发式 warm-start）
- 消融实验与泛化实验
- 自动绘图（柱状图/折线图）

## 运行

```bash
python experiments/run_experiments.py --num-instances 12 --jobs 10 --machines 10
```

输出默认写入 `experiments/results/`：

- `policy_results.json`：各策略主结果
- `ablation.json`：消融实验结果
- `generalization.json`：分布内/跨规模/OOD 结果
- `policy_*.png` 或 `policy_*.svg`：指标柱状图
- `ablation_objective.png` 或 `ablation_objective.svg`：消融对比图
- `generalization_gap.png` 或 `generalization_gap.svg`：泛化差距图

> 说明：该实现偏向研究原型，便于后续替换为真实 GNN + Double Dueling Distributional DQN 训练器。


若环境缺少 `matplotlib`，脚本会自动降级为输出 SVG 图，不影响实验可复现。
