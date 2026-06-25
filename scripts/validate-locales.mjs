import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);
const moduleCache = new Map();
const forbiddenPattern = /\b(casino|slot|bet|wager|jackpot|free spins|cashout|payout|credit|stake|gambling|bahis|freespin|spin|kredi|kazanç|çekim|yatırma)\b/i;

function resolveModule(request, fromFile) {
  if (!request.startsWith('.')) {
    return request;
  }

  const base = path.resolve(path.dirname(fromFile), request);
  for (const candidate of [`${base}.ts`, `${base}.js`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Cannot resolve ${request} from ${fromFile}`);
}

function loadTsModule(filePath) {
  const absolutePath = path.resolve(root, filePath);
  if (moduleCache.has(absolutePath)) {
    return moduleCache.get(absolutePath).exports;
  }

  const source = fs.readFileSync(absolutePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: absolutePath
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(absolutePath, module);

  const localRequire = (request) => {
    const resolved = resolveModule(request, absolutePath);
    if (resolved === 'typescript') {
      return ts;
    }
    if (!path.isAbsolute(resolved)) {
      return nativeRequire(resolved);
    }
    return loadTsModule(resolved);
  };

  vm.runInNewContext(output, {
    exports: module.exports,
    module,
    require: localRequire
  }, { filename: absolutePath });

  return module.exports;
}

const locales = loadTsModule('src/locales/index.ts');
const { SUPPORTED_LOCALES, translations } = locales;
const canonicalKeys = Object.keys(translations.en).sort();
let failed = false;

for (const locale of SUPPORTED_LOCALES) {
  const table = translations[locale];
  if (!table) {
    console.error(`[locale] Missing table: ${locale}`);
    failed = true;
    continue;
  }

  const keys = Object.keys(table).sort();
  const missing = canonicalKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !canonicalKeys.includes(key));
  const empty = keys.filter((key) => typeof table[key] !== 'string' || table[key].trim().length === 0);
  const forbidden = keys.filter((key) => forbiddenPattern.test(table[key]));
  const identicalToEnglish = locale !== 'en' && canonicalKeys.every((key) => table[key] === translations.en[key]);

  if (missing.length || extra.length || empty.length || forbidden.length || identicalToEnglish) {
    console.error(`[locale] ${locale} failed validation`);
    if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  extra: ${extra.join(', ')}`);
    if (empty.length) console.error(`  empty: ${empty.join(', ')}`);
    if (forbidden.length) console.error(`  forbidden words in: ${forbidden.join(', ')}`);
    if (identicalToEnglish) console.error('  table is identical to English');
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`[locale] ${SUPPORTED_LOCALES.length} locales passed parity, empty-value and forbidden-word checks.`);
