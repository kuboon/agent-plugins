export type Diagnostic = {
  filePath: string;
  jobName: string;
  message: string;
};

type WorkflowJobSummary = {
  hasRunsOn: boolean;
  hasUses: boolean;
  timeoutValue?: string;
};

function stripComments(line: string): string {
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== "\\")) {
      quote = quote === char ? null : quote ?? char;
      continue;
    }

    if (char === "#" && quote === null) {
      return line.slice(0, i);
    }
  }

  return line;
}

function parseKey(
  line: string,
): { indent: number; key: string; value: string } | null {
  const withoutComments = stripComments(line).replace(/\r$/, "");
  const indent = withoutComments.match(/^\s*/)?.[0].length ?? 0;
  const content = withoutComments.slice(indent);

  if (!content.trim() || content.startsWith("-") || content.startsWith("?")) {
    return null;
  }

  let quote: "'" | '"' | null = null;
  let separatorIndex = -1;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (
      (char === '"' || char === "'") && (i === 0 || content[i - 1] !== "\\")
    ) {
      quote = quote === char ? null : quote ?? char;
      continue;
    }

    if (char === ":" && quote === null) {
      const next = content[i + 1];
      if (next === undefined || /\s/.test(next)) {
        separatorIndex = i;
        break;
      }
    }
  }

  if (separatorIndex === -1) {
    return null;
  }

  const rawKey = content.slice(0, separatorIndex).trim();
  if (!rawKey) {
    return null;
  }

  const key = rawKey.replace(/^['"]|['"]$/g, "");
  const value = content.slice(separatorIndex + 1).trim();
  return { indent, key, value };
}

function parseJobs(text: string): Map<string, WorkflowJobSummary> {
  const jobs = new Map<string, WorkflowJobSummary>();
  const lines = text.split("\n");

  let jobsIndent: number | null = null;
  let currentJobName: string | null = null;
  let currentJobIndent: number | null = null;
  let currentPropertyIndent: number | null = null;

  for (const rawLine of lines) {
    const parsed = parseKey(rawLine);
    if (!parsed) {
      continue;
    }

    const { indent, key, value } = parsed;

    if (jobsIndent === null) {
      if (key === "jobs" && value === "") {
        jobsIndent = indent;
      }
      continue;
    }

    if (indent <= jobsIndent) {
      currentJobName = null;
      currentJobIndent = null;
      currentPropertyIndent = null;
      jobsIndent = key === "jobs" && value === "" ? indent : null;
      continue;
    }

    if (
      currentJobName === null ||
      (currentJobIndent !== null && indent <= currentJobIndent)
    ) {
      currentJobName = key;
      currentJobIndent = indent;
      currentPropertyIndent = null;
      jobs.set(currentJobName, { hasRunsOn: false, hasUses: false });
      continue;
    }

    if (currentJobIndent === null || indent <= currentJobIndent) {
      continue;
    }

    if (currentPropertyIndent === null) {
      currentPropertyIndent = indent;
    }

    if (indent !== currentPropertyIndent) {
      continue;
    }

    const job = jobs.get(currentJobName);
    if (!job) {
      continue;
    }

    if (key === "runs-on") {
      job.hasRunsOn = true;
    }

    if (key === "uses") {
      job.hasUses = true;
    }

    if (key === "timeout-minutes") {
      job.timeoutValue = value.trim();
    }
  }

  return jobs;
}

function isPositiveIntegerLiteral(value: string | undefined): boolean {
  return value !== undefined && /^[1-9]\d*$/.test(value);
}

function isExpression(value: string | undefined): boolean {
  return value !== undefined && /^\$\{\{[\s\S]+\}\}$/.test(value);
}

export function lintWorkflowText(text: string, filePath: string): Diagnostic[] {
  const jobs = parseJobs(text);
  const diagnostics: Diagnostic[] = [];

  for (const [jobName, job] of jobs) {
    const timeoutValue = job.timeoutValue?.trim();

    if (job.hasRunsOn && timeoutValue === undefined) {
      diagnostics.push({
        filePath,
        jobName,
        message: "runs-on job is missing timeout-minutes",
      });
      continue;
    }

    if (
      job.hasRunsOn && timeoutValue !== undefined &&
      !isExpression(timeoutValue) &&
      !isPositiveIntegerLiteral(timeoutValue)
    ) {
      diagnostics.push({
        filePath,
        jobName,
        message:
          "timeout-minutes must be a positive integer or GitHub Actions expression",
      });
    }

    if (job.hasUses && timeoutValue !== undefined) {
      diagnostics.push({
        filePath,
        jobName,
        message: "reusable-workflow caller jobs cannot define timeout-minutes",
      });
    }
  }

  return diagnostics;
}

export async function readStdin(
  stream: ReadableStream<Uint8Array> = Deno.stdin.readable,
): Promise<string> {
  return await new Response(stream).text();
}

function formatJobPath(jobName: string): string {
  return `jobs[${JSON.stringify(jobName)}]`;
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  return `${diagnostic.filePath}: ${
    formatJobPath(diagnostic.jobName)
  }: ${diagnostic.message}`;
}

export async function main(
  args: string[],
  stream: ReadableStream<Uint8Array> = Deno.stdin.readable,
): Promise<number> {
  try {
    const filePath = args[0] ?? "<stdin>";
    const text = await readStdin(stream);
    const diagnostics = lintWorkflowText(text, filePath);

    if (diagnostics.length === 0) {
      console.log("github-actions-timeout: OK");
      return 0;
    }

    for (const diagnostic of diagnostics) {
      console.error(formatDiagnostic(diagnostic));
    }

    return 1;
  } catch (error) {
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
