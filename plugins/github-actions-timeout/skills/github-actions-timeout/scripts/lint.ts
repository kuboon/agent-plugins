/**
 * Checks one GitHub Actions workflow, read from stdin, for missing or invalid
 * `timeout-minutes`.
 *
 *   deno run --no-lock lint.ts < .github/workflows/ci.yml
 *
 * It reads stdin only and never opens a file, so it runs with no permissions.
 * `--no-lock` keeps the caller's deno.lock untouched when this runs inside
 * their project.
 *
 * Exit status: 0 clean, 1 problems found, 2 input that is not a workflow, or
 * an argument (there are none; pipe the workflow in).
 */
// This file ships on its own, without a deno.json, and Deno looks for config
// from the working directory rather than beside the script, so an import map
// could never be found. The specifier has to be inline.
// deno-lint-ignore no-import-prefix
import { parse } from "jsr:@std/yaml@^1";

export interface Problem {
  /** Where in the workflow, e.g. `jobs.test` or `jobs.test.steps[2]`. */
  path: string;
  message: string;
}

export interface Result {
  jobs: number;
  problems: Problem[];
}

/** Thrown when the input is not a workflow at all. */
export class NotAWorkflowError extends Error {}

/** A value that is entirely one `${{ }}` expression, as the workflow schema defines it. */
const EXPRESSION = /^\$\{\{[\s\S]*\}\}$/;

/** GitHub caps a step at 360 minutes. A job has no cap beyond its runner's. */
const STEP_MAX_MINUTES = 360;

type Mapping = Record<string, unknown>;

function isMapping(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jobPath(id: string): string {
  return /^[A-Za-z_][\w-]*$/.test(id) ? `jobs.${id}` : `jobs[${JSON.stringify(id)}]`;
}

/** Returns why `value` is not a usable timeout, or null when it is. */
function invalidTimeout(value: unknown, max?: number): string | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) {
      return `timeout-minutes must be a positive whole number of minutes, got ${value}`;
    }
    if (max !== undefined && value > max) {
      return `timeout-minutes cannot exceed ${max} on a step, got ${value}`;
    }
    return null;
  }
  if (typeof value === "string") {
    if (EXPRESSION.test(value)) return null;
    if (/^\s*\d+\s*$/.test(value)) {
      return `timeout-minutes is the string "${value}"; remove the quotes`;
    }
  }
  return `timeout-minutes must be a positive whole number or a \${{ }} expression, got ${
    JSON.stringify(value)
  }`;
}

/** Lints one workflow's YAML text. Throws on YAML that is not a workflow. */
export function lintWorkflow(text: string): Result {
  const workflow = parse(text);
  if (!isMapping(workflow) || !isMapping(workflow.jobs)) {
    throw new NotAWorkflowError("not a workflow: no top-level `jobs` mapping");
  }

  const problems: Problem[] = [];
  const jobs = Object.entries(workflow.jobs);

  for (const [id, job] of jobs) {
    if (!isMapping(job)) continue;
    const path = jobPath(id);
    const hasTimeout = "timeout-minutes" in job && job["timeout-minutes"] !== null;

    if ("uses" in job) {
      if ("timeout-minutes" in job) {
        problems.push({
          path,
          message:
            "timeout-minutes is not allowed on a job that calls a reusable workflow; set it on the jobs inside the called workflow",
        });
      }
      continue;
    }

    if ("runs-on" in job) {
      if (!hasTimeout) {
        problems.push({ path, message: "missing timeout-minutes (the default is 360)" });
      } else {
        const why = invalidTimeout(job["timeout-minutes"]);
        if (why) problems.push({ path, message: why });
      }
    }

    if (Array.isArray(job.steps)) {
      job.steps.forEach((step, i) => {
        if (!isMapping(step) || !("timeout-minutes" in step)) return;
        const why = invalidTimeout(step["timeout-minutes"], STEP_MAX_MINUTES);
        if (why) problems.push({ path: `${path}.steps[${i}]`, message: why });
      });
    }
  }

  return { jobs: jobs.length, problems };
}

async function main(args: string[]): Promise<number> {
  if (args.length > 0) {
    console.error(
      "usage: deno run --no-lock lint.ts < workflow.yml  (stdin only; takes no arguments)",
    );
    return 2;
  }
  try {
    const { jobs, problems } = lintWorkflow(await new Response(Deno.stdin.readable).text());
    for (const p of problems) console.log(`${p.path}: ${p.message}`);
    const n = problems.length;
    console.log(
      n > 0 ? `${n} problem${n === 1 ? "" : "s"}` : `ok: ${jobs} job${jobs === 1 ? "" : "s"}`,
    );
    return n > 0 ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message.split("\n")[0] : String(error));
    return 2;
  }
}

if (import.meta.main) Deno.exit(await main(Deno.args));
