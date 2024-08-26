import _dirCommand from "@swc/cli/lib/swc/dir.js";
import _options from "@swc/cli/lib/swc/options.js";
import { join } from "path";
import { rimraf } from "rimraf";
import ts from "typescript";
import { fileURLToPath } from "url";

const { default: command } = _dirCommand;
const { default: parseArgs, initProgram } = _options;

const swcArgs = ["", "", "src", "--cli-config-file", "swc-cli.json"];

const buildEsmArgs = [
  "--config",
  "module.type=es6",
  "--out-file-extension",
  "mjs"
]

const buildCjsArgs = [
  "--config",
  "module.type=commonjs",
  "--out-file-extension",
  "cjs",
];

const isWatch = process.argv
  .slice(2)
  .some((arg) => ["watch", "w"].includes(arg));

if (isWatch) {
  swcArgs.push("--watch");
}

initProgram();
const esmOpts = parseArgs([...swcArgs, ...buildEsmArgs]);
const cjsOpts = parseArgs([...swcArgs, ...buildCjsArgs]);

esmOpts.swcOptions.jsc.experimental = {
  plugins: [
    [
      "@swc/plugin-transform-imports",
      {
        "^(~/|..?/.*?)(\\.m?tsx?)?$": {
          skipDefaultConversion: true,
          transform: "{{matches.[1]}}.mjs",
        },
      },
    ],
  ],
};

cjsOpts.swcOptions.jsc.experimental = {
  plugins: [
    [
      "@swc/plugin-transform-imports",
      {
        "^(..?/.*?)(\\.c?tsx?)?$": {
          skipDefaultConversion: true,
          transform: "{{matches.[1]}}.cjs",
        },
      },
    ],
  ],
};

if (!isWatch) {
  try {
    await rimraf(join( esmOpts.cliOptions.outDir ?? "lib", "**", "*"), {glob: true});
  } catch (err) {
    console.warn("Error cleaning build directory:", err);
  }
}

process.on("uncaughtException", function (err) {
  console.error(err);
  process.exit(1);
});

command(esmOpts).catch((err) => {
  console.error(err);
  process.exit(1);
});

command(cjsOpts).catch((err) => {
  console.error(err);
  process.exit(1);
});

const tsconfig = ts.findConfigFile(
  fileURLToPath(import.meta.url),
  ts.sys.fileExists,
  "tsconfig.json"
);

const tsOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  outDir: esmOpts.cliOptions.outDir,
};

if (isWatch) {
  const host = ts.createWatchCompilerHost(
    tsconfig,
    tsOptions,
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    (diagnostic) =>
      console.error(
        `[TS] Error (${diagnostic.code}): ${ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          ts.sys.newLine
        )}`
      ),
    (diagnostic) =>
      console.info(`[TS] Info (${diagnostic.code}): ${diagnostic.messageText}`)
  );

  ts.createWatchProgram(host);
} else {
  const config = ts.getParsedCommandLineOfConfigFile(
    tsconfig,
    tsOptions,
    ts.sys
  );
  ts.createProgram({
    rootNames: config.fileNames,
    options: config.options,
  }).emit();
}
