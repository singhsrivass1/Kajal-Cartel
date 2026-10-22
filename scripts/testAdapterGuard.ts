import { readFileSync, readdirSync, statSync } from 'fs';
import Module, { createRequire } from 'module';
import { join, relative, extname } from 'path';
import ts from 'typescript';

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

delete process.env.MONGODB_URI;

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const requireFromRoot = createRequire(join(ROOT, 'package.json'));

const INCOMPATIBLE_ADAPTER_METHODS = ['updateUser', 'unlinkAccount', 'updateSession', 'deleteSession', 'useVerificationToken'];
const COMPATIBLE_ADAPTER_METHODS = ['createUser', 'getUser', 'getUserByEmail', 'getUserByAccount', 'linkAccount'];
const ALLOWED_PROVIDER_TYPES = ['oauth', 'oidc', 'credentials'];
const EMAIL_PROVIDER_MODULES = /^(next-auth\/providers\/email|@auth\/core\/providers\/(email|nodemailer|resend|sendgrid|postmark|forwardemail|passkey)|nodemailer)$/;
const VERIFIED_VERSIONS = { 'next-auth': '4.24.14', '@next-auth/mongodb-adapter': '1.1.3' };
const VERIFIED_DRIVER_MAJOR = 7;

type Finding = { file: string; line: number; kind: string; name: string };

function findIncompatibleUsage(fileName: string, sourceText: string): Finding[] {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings: Finding[] = [];
  const add = (node: ts.Node, kind: string, name: string) =>
    findings.push({ file: fileName, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind, name });
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && INCOMPATIBLE_ADAPTER_METHODS.includes(node.name.text)) {
      add(node, 'member access', node.name.text);
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      INCOMPATIBLE_ADAPTER_METHODS.includes(node.argumentExpression.text)
    ) {
      add(node, 'element access', node.argumentExpression.text);
    } else if (ts.isBindingElement(node)) {
      const key = node.propertyName ?? node.name;
      if ((ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && INCOMPATIBLE_ADAPTER_METHODS.includes(key.text)) {
        add(node, 'destructuring', key.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (['.ts', '.tsx'].includes(extname(full))) out.push(full);
  }
  return out;
}

function makeDriver7FakeClient() {
  const collections = new Map<string, Array<Record<string, any>>>();
  const same = (a: any, b: any) =>
    a && typeof a.toHexString === 'function' && b && typeof b.toHexString === 'function' ? a.toHexString() === b.toHexString() : a === b;
  const matches = (doc: Record<string, any>, filter: Record<string, any>) => Object.entries(filter).every(([k, v]) => same(doc[k], v));
  const collection = (name: string) => {
    if (!collections.has(name)) collections.set(name, []);
    const docs = collections.get(name)!;
    return {
      async insertOne(doc: Record<string, any>) {
        docs.push(doc);
        return { acknowledged: true, insertedId: doc._id };
      },
      async findOne(filter: Record<string, any>) {
        return docs.find((d) => matches(d, filter)) ?? null;
      },
      async findOneAndUpdate(filter: Record<string, any>, update: { $set: Record<string, any> }) {
        const doc = docs.find((d) => matches(d, filter));
        if (!doc) return null;
        Object.assign(doc, update.$set);
        return doc;
      },
      async findOneAndDelete(filter: Record<string, any>) {
        const index = docs.findIndex((d) => matches(d, filter));
        if (index === -1) return null;
        return docs.splice(index, 1)[0];
      },
      async deleteMany(filter: Record<string, any>) {
        for (let i = docs.length - 1; i >= 0; i--) if (matches(docs[i], filter)) docs.splice(i, 1);
        return { acknowledged: true };
      },
      async deleteOne(filter: Record<string, any>) {
        const index = docs.findIndex((d) => matches(d, filter));
        if (index !== -1) docs.splice(index, 1);
        return { acknowledged: true };
      },
    };
  };
  return { client: Promise.resolve({ db: () => ({ collection }) }), collections };
}

async function main() {
  console.log('--- Dependency versions the reachability analysis was performed against ---');
  const installed = (name: string) => JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version as string;
  for (const [name, version] of Object.entries(VERIFIED_VERSIONS)) {
    check(`${name} is ${version} (re-verify reachability before changing)`, installed(name) === version, `installed ${installed(name)}`);
  }
  const driverVersion = installed('mongodb');
  check(`mongodb driver major is ${VERIFIED_DRIVER_MAJOR}`, Number(driverVersion.split('.')[0]) === VERIFIED_DRIVER_MAJOR, `installed ${driverVersion}`);
  const findAndModify = readFileSync(join(ROOT, 'node_modules/mongodb/lib/operations/find_and_modify.js'), 'utf8');
  check('installed driver defaults includeResultMetadata to false (returns the document, not { value })', findAndModify.includes('options.includeResultMetadata ??= false;'));
  const nextAuthInit = readFileSync(join(ROOT, 'node_modules/next-auth/core/init.js'), 'utf8');
  check('installed NextAuth defaults to database sessions whenever an adapter is set', nextAuthInit.includes('strategy: authOptions.adapter ? "database" : "jwt"'));

  console.log('\n--- Executable premise: adapter behaviour under driver-7 return semantics (in-memory, no database) ---');
  const { MongoDBAdapter } = requireFromRoot('@next-auth/mongodb-adapter');
  const fake = makeDriver7FakeClient();
  const adapter = MongoDBAdapter(fake.client);
  const created = await adapter.createUser({ name: 'Guard User', email: 'guard@example.test', emailVerified: null });
  check('createUser works', typeof created.id === 'string' && created.id.length === 24);
  check('getUser works', (await adapter.getUser(created.id))?.email === 'guard@example.test');
  check('getUserByEmail works', (await adapter.getUserByEmail('guard@example.test'))?.id === created.id);
  await adapter.linkAccount({ userId: created.id, type: 'oauth', provider: 'google', providerAccountId: 'guard-sub' });
  check('linkAccount works', (fake.collections.get('accounts') ?? []).length === 1);
  check('getUserByAccount works', (await adapter.getUserByAccount({ provider: 'google', providerAccountId: 'guard-sub' }))?.id === created.id);
  const updated = await adapter.updateUser({ id: created.id, name: 'Renamed' });
  check('updateUser is broken under driver 7 (returns no user)', !updated || !('id' in updated));
  const unlinked = await adapter.unlinkAccount({ provider: 'google', providerAccountId: 'guard-sub' });
  check('unlinkAccount is broken under driver 7 (returns no account)', !unlinked || !('provider' in unlinked));
  const expires = new Date(Date.now() + 60000);
  await adapter.createSession({ sessionToken: 'guard-session', userId: created.id, expires });
  const updatedSession = await adapter.updateSession({ sessionToken: 'guard-session', expires });
  check('updateSession is broken under driver 7 (returns no session)', !updatedSession || !('sessionToken' in updatedSession));
  const deletedSession = await adapter.deleteSession('guard-session');
  check('deleteSession is broken under driver 7 (returns no session)', !deletedSession || !('sessionToken' in deletedSession));
  await adapter.createVerificationToken({ identifier: 'guard@example.test', token: 'guard-token', expires });
  const usedToken = await adapter.useVerificationToken({ identifier: 'guard@example.test', token: 'guard-token' });
  check('useVerificationToken is broken under driver 7 (consumes the token but returns null)', usedToken === null && (fake.collections.get('verification_tokens') ?? []).length === 0);

  console.log('\n--- Real authOptions (lib/mongodb replaced by an inert stub; MONGODB_URI unset) ---');
  const mongodbLibPath = join(SRC, 'lib', 'mongodb.ts');
  const stub = new Module(mongodbLibPath);
  stub.filename = mongodbLibPath;
  stub.loaded = true;
  stub.exports = { __esModule: true, default: new Promise(() => undefined) };
  requireFromRoot.cache[mongodbLibPath] = stub;
  const { authOptions } = requireFromRoot(join(SRC, 'lib', 'auth.ts')) as { authOptions: Record<string, any> };
  check('the inert stub was used instead of the real connection module', requireFromRoot.cache[mongodbLibPath] === stub);
  check('a MongoDB adapter is configured (the setup this guard was written for)', !!authOptions.adapter && COMPATIBLE_ADAPTER_METHODS.every((m) => typeof authOptions.adapter[m] === 'function'));
  check('session strategy is explicitly "jwt"', authOptions.session?.strategy === 'jwt', `got ${JSON.stringify(authOptions.session?.strategy)}`);
  const effectiveStrategy = authOptions.session?.strategy ?? (authOptions.adapter ? 'database' : 'jwt');
  check('effective session strategy (NextAuth default rule applied) is "jwt"', effectiveStrategy === 'jwt', `got ${effectiveStrategy}`);
  const providers: Array<{ id: string; type: string }> = authOptions.providers ?? [];
  check('no provider has type "email"', providers.every((p) => p.type !== 'email'), providers.map((p) => `${p.id}:${p.type}`).join(', '));
  check(`every provider type is one of ${ALLOWED_PROVIDER_TYPES.join('/')}`, providers.length > 0 && providers.every((p) => ALLOWED_PROVIDER_TYPES.includes(p.type)), providers.map((p) => `${p.id}:${p.type}`).join(', '));

  console.log('\n--- Detector self-test (AST-based, not string matching) ---');
  const shouldFlag = [
    'adapter.updateUser(u);',
    'const r = await (await getAdapter()).unlinkAccount(x);',
    'authOptions.adapter?.updateSession?.(s);',
    'a["deleteSession"](t);',
    "a['useVerificationToken'](t);",
    'const { useVerificationToken } = adapter;',
    'const { deleteSession: remove } = adapter;',
  ];
  const shouldIgnore = [
    'const name = "updateUser";',
    '// adapter.updateSession(s)',
    '/* adapter.deleteSession(t) */',
    'const t = `useVerificationToken`;',
    'function updateUserProfile() {}',
    'const wrapped = { ...base, unlinkAccount: async () => null };',
    'const updateUserName = 1;',
  ];
  for (const snippet of shouldFlag) check(`flags: ${snippet}`, findIncompatibleUsage('snippet.ts', snippet).length > 0);
  for (const snippet of shouldIgnore) check(`ignores: ${snippet}`, findIncompatibleUsage('snippet.ts', snippet).length === 0);

  console.log('\n--- Application source scan (every .ts/.tsx under src/) ---');
  const files = sourceFiles(SRC);
  const usage: Finding[] = [];
  const emailImports: string[] = [];
  const nextAuthCalls: string[] = [];
  const optionObjects: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file).split('\\').join('/');
    usage.push(...findIncompatibleUsage(rel, text));
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && EMAIL_PROVIDER_MODULES.test(node.moduleSpecifier.text)) {
        emailImports.push(`${rel}: ${node.moduleSpecifier.text}`);
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'NextAuth') {
        const arg = node.arguments[0];
        nextAuthCalls.push(`${rel}:${arg && ts.isIdentifier(arg) ? arg.text : arg ? arg.getText(sf).slice(0, 40) : '(none)'}`);
      }
      if (ts.isVariableDeclaration(node) && node.type && node.type.getText(sf) === 'NextAuthOptions') {
        optionObjects.push(`${rel}:${node.name.getText(sf)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  check(`scanned ${files.length} application source files`, files.length > 50);
  check('no application code accesses, calls, or destructures an incompatible adapter method', usage.length === 0, usage.map((f) => `${f.file}:${f.line} ${f.kind} ${f.name}`).join('; '));
  check('no Email/magic-link provider module is imported', emailImports.length === 0, emailImports.join('; '));
  check('exactly one NextAuthOptions object exists (src/lib/auth.ts:authOptions)', optionObjects.length === 1 && optionObjects[0] === 'src/lib/auth.ts:authOptions', optionObjects.join('; '));
  check('every NextAuth(...) handler is built from the inspected authOptions', nextAuthCalls.length > 0 && nextAuthCalls.every((c) => c.endsWith(':authOptions')), nextAuthCalls.join('; '));

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Adapter guard failed to run:', err instanceof Error ? err.message : err);
  process.exit(1);
});
