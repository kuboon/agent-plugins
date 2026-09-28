import { parse } from "jsr:@std/yaml@1.0.7";

export type Diagnostic = {
  filePath: string;
  jobName: string;
  message: string;
};

type Workflow = {
  jobs?: Record<string, unknown>;
};

type WorkflowJob = {
  [key: string]: unknown;
  "runs-on"?: unknown;
  uses?: unknown;
  "timeout-minutes"?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

export function lintWorkflowText(text: string, filePath: string): Diagnostic[] {
  const document = parse(text) as Workflow;

  if (!isRecord(document)) {
    return [{ filePath, jobName: "<workflow>", message: "workflow must be a YAML mapping" }];
  }

  if (document.jobs === undefined) {
    return [];
  }

  if (!isRecord(document.jobs)) {
    return [{ filePath, jobName: "jobs", message: "jobs must be a mapping" }];
  }

  const diagnostics: Diagnostic[] = [];

  for (const [jobName, rawJob] of Object.entries(document.jobs)) {
    if (!isRecord(rawJob)) {
      diagnostics.push({ filePath, jobName, message: "job definition must be a mapping" });
      continue;
    }

    const job = rawJob as WorkflowJob;
    const hasRunsOn = job["runs-on"] !== undefined;
    const hasUses = typeof job.uses === "string";
    const timeout = job["timeout-minutes"];

    if (hasRunsOn && timeout === undefined) {
      diagnostics.push({
        filePath,
        jobName,
        message: "runs-on job is missing timeout-minutes",
      });
      continue;
    }

    if (hasRunsOn && timeout !== undefined && !isPositiveInteger(timeout)) {
      diagnostics.push({
        filePath,
        jobName,
        message: "timeout-minutes must be a positive integer",
      });
    }

    if (hasUses && timeout !== undefined) {
      diagnostics.push({
        filePath,
        jobName,
        message: "reusable-workflow caller jobs cannot define timeout-minutes",
      });
    }
  }

  return diagnostics;
}

function isWorkflowFile(path: string): boolean {
  return path.endsWith(".yml") || path.endsWith(".yaml");
}

export async function collectWorkflowFiles(inputPaths: string[]): Promise<string[]> {
  const candidates = inputPaths.length === 0 ? [".github/workflows"] : inputPaths;
  const files = new Set<string>();

  for (const inputPath of candidates) {
    const stat = await Deno.stat(inputPath);

    if (stat.isFile) {
      if (isWorkflowFile(inputPath)) {
        files.add(inputPath);
      }
      continue;
    }

    for await (const entry of Deno.readDir(inputPath)) {
      const childPath = `${inputPath}/${entry.name}`;
      if (entry.isFile && isWorkflowFile(childPath)) {
        files.add(childPath);
      }
    }
  }

  return [...files].sort();
}

export async function lintFiles(paths: string[]): Promise<Diagnostic[]> {
  const workflowFiles = await collectWorkflowFiles(paths);
  const diagnostics: Diagnostic[] = [];

  for (const filePath of workflowFiles) {
    const text = await Deno.readTextFile(filePath);
    diagnostics.push(...lintWorkflowText(text, filePath));
  }

  return diagnostics;
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  return `${diagnostic.filePath}: jobs.${diagnostic.jobName}: ${diagnostic.message}`;
}

export async function main(args: string[]): Promise<number> {
  try {
    const diagnostics = await lintFiles(args);

    if (diagnostics.length === 0) {
      console.log("github-actions-timeout: OK");
      return 0;
    }

    for (const diagnostic of diagnostics) {
      console.error(formatDiagnostic(diagnostic));
    }

    return 1;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`github-actions-timeout: path not found: ${error.message}`);
      return 2;
    }

    if (error instanceof Error) {
      console.error(`github-actions-timeout: ${error.message}`);
      return 2;
    }

    console.error("github-actions-timeout: unknown error");
    return 2;
  }
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args));
}
