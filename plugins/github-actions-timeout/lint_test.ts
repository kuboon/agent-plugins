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

function failingStream(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error(message));
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

Deno.test("accepts GitHub Actions expressions for timeout-minutes", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: \${{ inputs.timeout }}
`,
    "/repo/.github/workflows/reusable.yml",
  );

  assertEquals(diagnostics, []);
});

Deno.test("accepts quoted GitHub Actions expressions for timeout-minutes", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: "\${{ inputs.timeout }}"
`,
    "/repo/.github/workflows/reusable.yml",
  );

  assertEquals(diagnostics, []);
});

Deno.test("supports quoted job keys with colons", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  "build:test":
    runs-on: ubuntu-latest
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/ci.yml",
      jobName: "build:test",
      message: "runs-on job is missing timeout-minutes",
    },
  ]);
});

Deno.test("supports plain job keys with colons", () => {
  const diagnostics = lintWorkflowText(
    `jobs:
  build:test:
    runs-on: ubuntu-latest
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/ci.yml",
      jobName: "build:test",
      message: "runs-on job is missing timeout-minutes",
    },
  ]);
});

Deno.test("rejects inline jobs mappings explicitly", () => {
  const diagnostics = lintWorkflowText(
    `jobs: {}
name: CI
`,
    "/repo/.github/workflows/ci.yml",
  );

  assertEquals(diagnostics, [
    {
      filePath: "/repo/.github/workflows/ci.yml",
      jobName: "jobs",
      message: "inline jobs mappings are not supported by this linter",
    },
  ]);
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
      message:
        "timeout-minutes must be a positive integer or GitHub Actions expression",
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

Deno.test("main returns 0 when lint succeeds", async () => {
  const stdout: string[] = [];
  const restore = console.log;
  console.log = (...args: unknown[]) => {
    stdout.push(args.join(" "));
  };

  try {
    const exitCode = await main(
      [".github/workflows/ci.yml"],
      streamFromText(
        `jobs:\n  test:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n`,
      ),
    );
    assertEquals(exitCode, 0);
    assertEquals(stdout, ["github-actions-timeout: OK"]);
  } finally {
    console.log = restore;
  }
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
      '.github/workflows/ci.yml: jobs["test"]: runs-on job is missing timeout-minutes',
    ]);
  } finally {
    console.error = restore;
  }
});

Deno.test("main returns 2 when stdin cannot be read", async () => {
  const stderr: string[] = [];
  const restore = console.error;
  console.error = (...args: unknown[]) => {
    stderr.push(args.join(" "));
  };

  try {
    const exitCode = await main(
      [".github/workflows/ci.yml"],
      failingStream("boom"),
    );
    assertEquals(exitCode, 2);
    assertEquals(stderr, ["github-actions-timeout: boom"]);
  } finally {
    console.error = restore;
  }
});
