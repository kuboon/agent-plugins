import { lintWorkflowText, main, readStdin } from "./lint.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText !== expectedText) {
    throw new Error(
      `assertEquals failed\nactual:   ${actualText}\nexpected: ${expectedText}`,
    );
  }
}

function streamFromText(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

Deno.test("accepts runs-on jobs with timeout-minutes", () => {
  const diagnostics = lintWorkflowText(
    `name: CI
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: deno test
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, []);
});

Deno.test("reports runs-on jobs without timeout-minutes", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: deno test
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/ci.yml",
      jobName: "test",
      message: "runs-on job is missing timeout-minutes",
    },
  ]);
});

Deno.test("reports non-integer timeout-minutes values", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: ten
    steps:
      - run: deno test
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/ci.yml",
      jobName: "test",
      message: "timeout-minutes must be a positive integer",
    },
  ]);
});

Deno.test("reports timeout-minutes on reusable-workflow caller jobs", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  pages:
    uses: owner/repo/.github/workflows/build.yml@main
    timeout-minutes: 10
`,
    "/repo/.github/workflows/pages.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/pages.yml",
      jobName: "pages",
      message: "reusable-workflow caller jobs cannot define timeout-minutes",
    },
  ]);
});

Deno.test("ignores nested timeout-minutes under a step", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: ./scripts/wait.sh
        timeout-minutes: 2
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, []);
});

Deno.test("readStdin returns the piped yaml text", async () => {
  const text = await readStdin(streamFromText("jobs: {}\n"));
  assertEquals(text, "jobs: {}\n");
});

Deno.test("main returns 1 when diagnostics are found", async () => {
  const stderr: string[] = [];
  const restore = console.error;
  console.error = (...args: unknown[]) => {
    stderr.push(args.join(" "));
  };

  try {
    const exitCode = await main(
      [".github/workflows/ci.yml"],
      streamFromText(`jobs:\n  test:\n    runs-on: ubuntu-latest\n`),
    );
    assertEquals(exitCode, 1);
    assertEquals(stderr, [
      ".github/workflows/ci.yml: jobs.test: runs-on job is missing timeout-minutes",
    ]);
  } finally {
    console.error = restore;
  }
});
