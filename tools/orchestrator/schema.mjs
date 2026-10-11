import { z } from 'zod';

const id = z.string().regex(/^[A-Z][A-Z0-9-]{0,49}$/);
const path = z.string().min(1).max(240).refine(v => !v.includes('..') && !v.includes(':') && !v.startsWith('/') && !v.includes('\\'), 'Use a relative repository path');
export const states = ['PLANNED', 'APPROVED', 'RUNNING', 'VERIFYING', 'READY_FOR_REVIEW', 'ACCEPTED', 'PAUSED', 'WAITING_FOR_QUOTA', 'BLOCKED', 'FAILED', 'UNKNOWN'];
export const Plan = z.object({
  version: z.literal(1),
  phases: z.array(z.object({
    id, title: z.string().min(1).max(200), dependencies: z.array(id),
    tasks: z.array(z.object({
      id, objective: z.string().min(1).max(4000), inputs: z.array(path), dependencies: z.array(id),
      files: z.array(path).min(1), acceptance: z.array(z.string().min(1).max(1000)).min(1),
      tests: z.array(z.enum(['lint', 'typecheck', 'test', 'build', 'test:e2e', 'simulation'])).min(1),
      maxRetries: z.number().int().min(0).max(3),
    }).strict()).min(1).max(40),
  }).strict()).min(1).max(10),
}).strict().superRefine((plan, ctx) => {
  const phases = new Set(); const tasks = new Set();
  for (const phase of plan.phases) {
    if (phases.has(phase.id) || phase.dependencies.some(d => !phases.has(d))) ctx.addIssue({ code: 'custom', message: 'Phase IDs must be unique and dependencies must precede them' });
    phases.add(phase.id);
    for (const task of phase.tasks) {
      if (tasks.has(task.id) || task.dependencies.some(d => !tasks.has(d))) ctx.addIssue({ code: 'custom', message: 'Task IDs must be unique and dependencies must precede them' });
      tasks.add(task.id);
    }
  }
});
export const Snapshot = z.object({
  version: z.literal(1), planHash: z.string(), identity: z.object({ root: z.string(), gitDir: z.string(), remote: z.string() }),
  stopped: z.boolean(), revision: z.number().int().nonnegative(),
  phases: z.array(z.object({ id, title: z.string(), state: z.enum(states), approval: z.string().nullable(), error: z.string().nullable() })),
  tasks: z.array(z.object({
    id, phaseId: id, state: z.enum(states), attempts: z.number().int().nonnegative(), workerRunId: z.string().nullable(),
    workerPid: z.number().int().nullable(), branch: z.string().nullable(), commit: z.string().nullable(),
    checkpoint: z.any().nullable(), errorHistory: z.array(z.object({ at: z.number(), code: z.string() })),
    tests: z.array(z.object({ name: z.string(), code: z.number().nullable() })), review: z.object({ note: z.string(), fingerprint: z.string() }).nullable(),
    notBefore: z.number(),
  })), approvals: z.array(z.object({ phaseId: id, action: z.enum(['BEGIN', 'ACCEPT']), planHash: z.string(), at: z.number() })),
  events: z.array(z.object({ at: z.number(), code: z.string(), task: z.string().nullable() })),
});
