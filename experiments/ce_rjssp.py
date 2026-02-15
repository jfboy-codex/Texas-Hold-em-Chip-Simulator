from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple
import math
import random


@dataclass
class Operation:
    job_id: int
    op_idx: int
    proc_time: int
    candidate_machines: List[int]
    energy_rate: float
    batch_group: Optional[int] = None


@dataclass
class Job:
    job_id: int
    operations: List[Operation]
    due_date: int


@dataclass
class MaintenanceWindow:
    start: int
    end: int


@dataclass
class Machine:
    machine_id: int
    energy_rate: float
    maintenance: List[MaintenanceWindow] = field(default_factory=list)
    breakdown_prob: float = 0.0
    busy_until: int = 0
    last_job_id: Optional[int] = None


@dataclass
class Instance:
    jobs: List[Job]
    machines: List[Machine]
    setup_times: Dict[Tuple[Optional[int], int, int], int]
    weights: Dict[str, float]


@dataclass
class ScheduleResult:
    makespan: int
    total_tardiness: float
    total_energy: float
    avg_wip: float
    objective: float
    decision_count: int


class CERSchedulingEnv:
    """Discrete-event CE-RJSSP simulator with flexible machine assignment and constraints."""

    def __init__(self, instance: Instance, seed: int = 0):
        self.instance = instance
        self.rng = random.Random(seed)
        self.t = 0
        self.job_next_idx = {job.job_id: 0 for job in instance.jobs}
        self.job_ready_time = {job.job_id: 0 for job in instance.jobs}
        self.job_completion = {job.job_id: 0 for job in instance.jobs}
        self.machine_busy_until = {m.machine_id: 0 for m in instance.machines}
        self.machine_last_job = {m.machine_id: None for m in instance.machines}
        self.total_energy = 0.0
        self.wip_integral = 0.0
        self.last_t_for_wip = 0
        self.decisions = 0

    def done(self) -> bool:
        return all(self.job_next_idx[j.job_id] >= len(j.operations) for j in self.instance.jobs)

    def _current_wip(self) -> int:
        count = 0
        for job in self.instance.jobs:
            idx = self.job_next_idx[job.job_id]
            if idx < len(job.operations):
                count += 1
        return count

    def _accumulate_wip(self, new_t: int) -> None:
        wip = self._current_wip()
        self.wip_integral += wip * (new_t - self.last_t_for_wip)
        self.last_t_for_wip = new_t

    def _maintenance_delay(self, machine_id: int, start: int, duration: int) -> int:
        machine = self.instance.machines[machine_id]
        s = start
        for w in sorted(machine.maintenance, key=lambda x: x.start):
            if s < w.end and (s + duration) > w.start:
                s = w.end
        return s

    def ready_actions(self) -> List[Tuple[int, int, int]]:
        actions: List[Tuple[int, int, int]] = []
        for job in self.instance.jobs:
            idx = self.job_next_idx[job.job_id]
            if idx >= len(job.operations):
                continue
            if self.job_ready_time[job.job_id] > self.t:
                continue
            op = job.operations[idx]
            for m in op.candidate_machines:
                if self.machine_busy_until[m] <= self.t:
                    actions.append((job.job_id, idx, m))
        return actions

    def advance_time(self) -> None:
        next_events = [v for v in self.machine_busy_until.values() if v > self.t]
        next_events += [v for v in self.job_ready_time.values() if v > self.t]
        if not next_events:
            return
        nxt = min(next_events)
        self._accumulate_wip(nxt)
        self.t = nxt

    def dispatch(self, action: Tuple[int, int, int]) -> None:
        job_id, op_idx, machine_id = action
        job = self.instance.jobs[job_id]
        op = job.operations[op_idx]

        base_start = max(self.t, self.machine_busy_until[machine_id], self.job_ready_time[job_id])
        setup = self.instance.setup_times.get((self.machine_last_job[machine_id], job_id, machine_id), 0)
        start = self._maintenance_delay(machine_id, base_start + setup, op.proc_time)

        duration = op.proc_time
        machine = self.instance.machines[machine_id]
        if self.rng.random() < machine.breakdown_prob:
            duration += self.rng.randint(1, max(2, op.proc_time // 3))

        end = start + duration
        self.machine_busy_until[machine_id] = end
        self.machine_last_job[machine_id] = job_id
        self.job_ready_time[job_id] = end
        self.job_next_idx[job_id] += 1
        if self.job_next_idx[job_id] >= len(job.operations):
            self.job_completion[job_id] = end

        self.total_energy += duration * (machine.energy_rate + op.energy_rate)
        self.decisions += 1

    def run_with_policy(self, policy: "BasePolicy") -> ScheduleResult:
        while not self.done():
            actions = self.ready_actions()
            if not actions:
                self.advance_time()
                continue
            action = policy.select_action(self, actions)
            self.dispatch(action)

        finish_time = max(self.job_completion.values()) if self.job_completion else self.t
        self._accumulate_wip(finish_time)
        total_tardiness = 0.0
        for job in self.instance.jobs:
            total_tardiness += max(0, self.job_completion[job.job_id] - job.due_date)

        avg_wip = self.wip_integral / max(1, finish_time)
        w = self.instance.weights
        objective = (
            w["makespan"] * finish_time
            + w["tardiness"] * total_tardiness
            + w["energy"] * self.total_energy
            + w["wip"] * avg_wip
        )
        return ScheduleResult(
            makespan=finish_time,
            total_tardiness=total_tardiness,
            total_energy=self.total_energy,
            avg_wip=avg_wip,
            objective=objective,
            decision_count=self.decisions,
        )


class BasePolicy:
    name = "base"

    def select_action(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        raise NotImplementedError


class FIFOPolicy(BasePolicy):
    name = "FIFO"

    def select_action(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        return sorted(actions, key=lambda a: (a[0], a[1], a[2]))[0]


class SPTPolicy(BasePolicy):
    name = "SPT"

    def select_action(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        def score(a: Tuple[int, int, int]) -> float:
            j, idx, _ = a
            return env.instance.jobs[j].operations[idx].proc_time

        return min(actions, key=score)


class LPTPolicy(BasePolicy):
    name = "LPT"

    def select_action(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        def score(a: Tuple[int, int, int]) -> float:
            j, idx, _ = a
            return env.instance.jobs[j].operations[idx].proc_time

        return max(actions, key=score)


class MWKRPolicy(BasePolicy):
    name = "MWKR"

    def select_action(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        def rem_work(job_id: int) -> float:
            job = env.instance.jobs[job_id]
            idx = env.job_next_idx[job_id]
            return sum(op.proc_time for op in job.operations[idx:])

        return max(actions, key=lambda a: rem_work(a[0]))


class ATCPolicy(BasePolicy):
    name = "ATC"

    def select_action(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        mean_p = sum(env.instance.jobs[j].operations[idx].proc_time for j, idx, _ in actions) / max(1, len(actions))

        def score(a: Tuple[int, int, int]) -> float:
            j, idx, _ = a
            job = env.instance.jobs[j]
            op = job.operations[idx]
            slack = max(0.0, job.due_date - env.t - op.proc_time)
            return (1 / max(1, op.proc_time)) * math.exp(-slack / max(1.0, 2 * mean_p))

        return max(actions, key=score)


class RandomPolicy(BasePolicy):
    name = "Random"

    def __init__(self, seed: int = 0):
        self.rng = random.Random(seed)

    def select_action(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        return self.rng.choice(list(actions))


class G4DQNPolicy(BasePolicy):
    """Lightweight graph-feature based policy with heuristic-guided candidate selection.

    This approximates the requested G4DQN ingredients while staying dependency-light.
    """

    name = "G4DQN"

    def __init__(
        self,
        top_k: int = 5,
        use_candidate_set: bool = True,
        use_multi_objective: bool = True,
        use_action_mask: bool = True,
        warm_start: bool = True,
    ):
        self.top_k = top_k
        self.use_candidate_set = use_candidate_set
        self.use_multi_objective = use_multi_objective
        self.use_action_mask = use_action_mask
        self.warm_start = warm_start
        self.weights = {
            "proc": -0.6,
            "mwkr": 0.8,
            "slack": -0.5,
            "energy": -0.3,
            "avail": -0.2,
        }
        if warm_start:
            self.weights.update({"proc": -0.55, "mwkr": 0.9, "slack": -0.7})

    def _features(self, env: CERSchedulingEnv, a: Tuple[int, int, int]) -> Dict[str, float]:
        j, idx, m = a
        job = env.instance.jobs[j]
        op = job.operations[idx]
        remaining = sum(x.proc_time for x in job.operations[idx:])
        slack = (job.due_date - env.t - remaining)
        avail = env.machine_busy_until[m] - env.t
        return {
            "proc": op.proc_time,
            "mwkr": remaining,
            "slack": slack,
            "energy": op.energy_rate + env.instance.machines[m].energy_rate,
            "avail": avail,
        }

    def _score(self, feats: Dict[str, float]) -> float:
        return sum(self.weights[k] * v for k, v in feats.items())

    def _candidate_actions(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> List[Tuple[int, int, int]]:
        ranked = sorted(actions, key=lambda a: self._score(self._features(env, a)), reverse=True)
        if not self.use_candidate_set:
            return ranked
        return ranked[: min(self.top_k, len(ranked))]

    def select_action(self, env: CERSchedulingEnv, actions: Sequence[Tuple[int, int, int]]) -> Tuple[int, int, int]:
        candidates = self._candidate_actions(env, actions)
        if not self.use_multi_objective:
            return max(candidates, key=lambda a: -self._features(env, a)["proc"])
        return max(candidates, key=lambda a: self._score(self._features(env, a)))


def generate_instance(
    num_jobs: int,
    num_machines: int,
    reentry_prob: float,
    hotspot_intensity: float,
    setup_variance: float,
    breakdown_freq: float,
    due_tightness: float,
    seed: int,
) -> Instance:
    rng = random.Random(seed)
    machines: List[Machine] = []
    hotspot_machines = set(rng.sample(range(num_machines), k=max(1, int(num_machines * hotspot_intensity))))
    for m in range(num_machines):
        maintenance = []
        if rng.random() < 0.6:
            start = rng.randint(20, 80)
            maintenance.append(MaintenanceWindow(start=start, end=start + rng.randint(5, 15)))
        machines.append(
            Machine(
                machine_id=m,
                energy_rate=rng.uniform(0.8, 2.0) * (1.2 if m in hotspot_machines else 1.0),
                maintenance=maintenance,
                breakdown_prob=max(0.0, breakdown_freq + (0.02 if m in hotspot_machines else 0.0)),
            )
        )

    jobs: List[Job] = []
    for j in range(num_jobs):
        base_ops = rng.randint(4, 8)
        op_count = base_ops + (1 if rng.random() < reentry_prob else 0)
        ops: List[Operation] = []
        used_groups: List[List[int]] = []
        for idx in range(op_count):
            if idx > 1 and rng.random() < reentry_prob and used_groups:
                cands = rng.choice(used_groups)
            else:
                group_size = min(num_machines, rng.randint(1, max(2, num_machines // 2)))
                cands = sorted(rng.sample(range(num_machines), k=group_size))
                used_groups.append(cands)
            proc = rng.randint(2, 15)
            ops.append(Operation(j, idx, proc, cands, energy_rate=rng.uniform(0.3, 1.2)))

        nominal = sum(op.proc_time for op in ops)
        due = int(nominal * rng.uniform(1.2, 2.2) * due_tightness)
        jobs.append(Job(job_id=j, operations=ops, due_date=due))

    setup_times: Dict[Tuple[Optional[int], int, int], int] = {}
    for m in range(num_machines):
        for prev in [None] + list(range(num_jobs)):
            for nxt in range(num_jobs):
                if prev == nxt:
                    setup = 0
                else:
                    spread = max(1, int(5 * setup_variance))
                    setup = rng.randint(0, spread)
                setup_times[(prev, nxt, m)] = setup

    weights = {"makespan": 1.0, "tardiness": 0.7, "energy": 0.15, "wip": 0.4}
    return Instance(jobs=jobs, machines=machines, setup_times=setup_times, weights=weights)
