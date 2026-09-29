/**
 * Checks GitHub Actions workflows for missing or invalid `timeout-minutes`.
 *
 *   deno run --no-lock --allow-read lint.ts .github/workflows/*.yml
 *   deno run --no-lock lint.ts < .github/workflows/ci.yml
 *
 * `--no-lock` keeps the caller's deno.lock untouched when this runs inside
 * their project. Reading stdin needs no permissions at all.
 *
 * Exit status: 0 clean, 1 problems found, 2 a file could not be read, parsed,
 * or is not a workflow.
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
  const sources = args.length > 0 ? args : ["-"];
  let problemCount = 0;
  let jobCount = 0;
  let failed = false;

  for (const source of sources) {
    const label = source === "-" ? "<stdin>" : source;
    try {
      const text = source === "-"
        ? await new Response(Deno.stdin.readable).text()
        : await Deno.readTextFile(source);
      const { jobs, problems } = lintWorkflow(text);
      jobCount += jobs;
      problemCount += problems.length;
      for (const p of problems) console.log(`${label}: ${p.path}: ${p.message}`);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.error(`${label}: ${message}`);
    }
  }

  const files = `${sources.length} file${sources.length === 1 ? "" : "s"}`;
  if (problemCount > 0) {
    console.log(`${problemCount} problem${problemCount === 1 ? "" : "s"} in ${files}`);
  } else if (!failed) {
    console.log(`ok: ${jobCount} job${jobCount === 1 ? "" : "s"} in ${files}`);
  }
  return failed ? 2 : problemCount > 0 ? 1 : 0;
}

if (import.meta.main) Deno.exit(await main(Deno.args));
