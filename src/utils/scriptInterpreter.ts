/**
 * Tiny, dependency-free interpreter for the subset of JavaScript used by card
 * render scripts. It deliberately has no access to the DOM, network, timers,
 * prototypes or host constructors, so importing an untrusted template pack
 * cannot execute arbitrary code.
 */

type Value = unknown;
type Node =
  | { kind: 'literal'; value: Value }
  | { kind: 'identifier'; name: string; position?: number }
  | { kind: 'template'; parts: Array<{ text?: string; expr?: Node }> }
  | { kind: 'object'; entries: Array<{ key: string; value: Node }> }
  | { kind: 'array'; items: Node[] }
  | { kind: 'unary'; operator: string; argument: Node }
  | { kind: 'binary'; operator: string; left: Node; right: Node }
  | { kind: 'logical'; operator: string; left: Node; right: Node }
  | { kind: 'conditional'; test: Node; consequent: Node; alternate: Node }
  | { kind: 'member'; object: Node; property: Node; position?: number }
  | { kind: 'call'; callee: Node; args: Node[]; position?: number }
  | { kind: 'block'; body: Node[] }
  | { kind: 'if'; test: Node; consequent: Node; alternate?: Node }
  | { kind: 'assignment'; name: string; value: Node }
  | { kind: 'return'; value: Node };

interface TemplatePart {
  text?: string;
  expr?: string;
}

interface Token {
  type: 'number' | 'string' | 'template' | 'ident' | 'keyword' | 'punct' | 'eof';
  value: string;
  parts?: TemplatePart[];
  position: number;
}

export class ScriptSyntaxError extends Error {
  /** 1-based line in the original script, when known. */
  line?: number;
}

// Resource limits for scripts embedded in untrusted template packs.
const MAX_SCRIPT_LENGTH = 20_000;
const MAX_TOKENS = 4_000;
const MAX_STEPS = 20_000;
const MAX_STRING_LENGTH = 200_000;
const MAX_REPEAT = 100;
const MAX_PAD = 10_000;

/** Per-evaluation state: no shared budget that could leak between nested runs. */
interface EvalState {
  steps: number;
}

let currentScriptSource = '';

function syntaxError(message: string, position?: number): ScriptSyntaxError {
  const error = new ScriptSyntaxError(message);
  if (position !== undefined && currentScriptSource) {
    error.line = currentScriptSource.slice(0, position).split('\n').length;
  }
  return error;
}

function tick(state: EvalState): void {
  if (--state.steps < 0) throw syntaxError('Script trop long ou trop coûteux.');
}

function limitString(value: string): string {
  if (value.length > MAX_STRING_LENGTH) {
    throw syntaxError('Script: chaîne de résultat trop longue.');
  }
  return value;
}

const KEYWORDS = new Set(['const', 'let', 'return', 'true', 'false', 'null', 'undefined']);
const MULTI_PUNCT = ['===', '!==', '==', '!=', '>=', '<=', '&&', '||', '??'];
const SINGLE_PUNCT = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '!',
  '<',
  '>',
  '?',
  ':',
  '.',
  ',',
  ';',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '=',
]);

const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 2,
  '??': 2,
  '&&': 3,
  '==': 4,
  '!=': 4,
  '===': 4,
  '!==': 4,
  '<': 5,
  '>': 5,
  '<=': 5,
  '>=': 5,
  '+': 6,
  '-': 6,
  '*': 7,
  '/': 7,
  '%': 7,
};

function unescape(raw: string): string {
  return raw.replace(/\\(n|r|t|b|f|v|0|\\|'|"|`|\$)/g, (_, code: string) => {
    switch (code) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'v':
        return '\v';
      case '0':
        return '\0';
      default:
        return code;
    }
  });
}

function tokenize(source: string): Token[] {
  if (source.length > MAX_SCRIPT_LENGTH) {
    throw syntaxError(`Script trop long (${MAX_SCRIPT_LENGTH} caractères maximum).`);
  }
  const tokens: Token[] = [];
  let i = 0;

  const readQuoted = (quote: string): string => {
    i++; // opening quote
    let raw = '';
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') {
        raw += source[i] + (source[i + 1] ?? '');
        i += 2;
      } else {
        raw += source[i++];
      }
    }
    if (source[i] !== quote) throw syntaxError('Chaîne non terminée.', i);
    i++;
    return unescape(raw);
  };

  const readTemplate = (): TemplatePart[] => {
    i++; // backtick
    const parts: TemplatePart[] = [];
    let text = '';

    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') {
        text += source[i] + (source[i + 1] ?? '');
        i += 2;
        continue;
      }
      if (ch === '`') {
        parts.push({ text: unescape(text) });
        i++;
        return parts;
      }
      if (ch === '$' && source[i + 1] === '{') {
        parts.push({ text: unescape(text) });
        text = '';
        i += 2;
        let depth = 1;
        let expression = '';
        while (i < source.length && depth > 0) {
          const c = source[i];
          if (c === '\\') {
            expression += c + (source[i + 1] ?? '');
            i += 2;
            continue;
          }
          if (c === '`') {
            const nestedStart = i;
            readTemplate();
            expression += source.slice(nestedStart, i);
            continue;
          }
          if (c === '{') depth++;
          if (c === '}') {
            depth--;
            if (depth === 0) {
              i++;
              break;
            }
          }
          expression += c;
          i++;
        }
        parts.push({ expr: expression });
        continue;
      }
      text += ch;
      i++;
    }
    throw syntaxError('Template literal non terminé.');
  };

  while (i < source.length) {
    if (tokens.length >= MAX_TOKENS) {
      throw syntaxError(`Script trop complexe (${MAX_TOKENS} jetons maximum).`);
    }
    const ch = source[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) throw syntaxError('Commentaire non terminé.');
      i = end + 2;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] || ''))) {
      const start = i;
      let seenDot = false;
      let seenExponent = false;
      while (i < source.length) {
        const digit = source[i];
        if (/[0-9_]/.test(digit)) {
          i++;
        } else if (digit === '.' && !seenDot && !seenExponent) {
          seenDot = true;
          i++;
        } else if ((digit === 'e' || digit === 'E') && !seenExponent) {
          seenExponent = true;
          i++;
          if (source[i] === '+' || source[i] === '-') i++;
        } else {
          break;
        }
      }
      tokens.push({
        type: 'number',
        value: source.slice(start, i).replace(/_/g, ''),
        position: start,
      });
      continue;
    }
    if (ch === '"' || ch === "'") {
      const start = i;
      tokens.push({ type: 'string', value: readQuoted(ch), position: start });
      continue;
    }
    if (ch === '`') {
      const start = i;
      tokens.push({ type: 'template', value: '', parts: readTemplate(), position: start });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i;
      while (i < source.length && /[A-Za-z0-9_$]/.test(source[i])) i++;
      const value = source.slice(start, i);
      tokens.push({ type: KEYWORDS.has(value) ? 'keyword' : 'ident', value, position: start });
      continue;
    }
    const multi = MULTI_PUNCT.find((p) => source.startsWith(p, i));
    if (multi) {
      tokens.push({ type: 'punct', value: multi, position: i });
      i += multi.length;
      continue;
    }
    if (SINGLE_PUNCT.has(ch)) {
      tokens.push({ type: 'punct', value: ch, position: i });
      i++;
      continue;
    }
    throw syntaxError(`Caractère inattendu « ${ch} » à la position ${i}.`, i);
  }

  tokens.push({ type: 'eof', value: '', position: i });
  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  private get current(): Token {
    return this.tokens[this.index];
  }

  private consume(value?: string): Token {
    const token = this.current;
    if (value !== undefined && token.value !== value) {
      throw syntaxError(`Attendu « ${value} » à la position ${token.position}.`, token.position);
    }
    this.index++;
    return token;
  }

  private match(value: string): boolean {
    return this.current.value === value;
  }

  parse(): Node[] {
    const statements: Node[] = [];
    while (this.current.type !== 'eof') statements.push(this.parseStatement());
    return statements;
  }

  private parseStatement(): Node {
    if (this.match('{')) return this.parseBlock();
    if (this.match('if')) return this.parseIf();
    if (this.match('const') || this.match('let')) return this.parseDeclaration();
    if (this.match('return')) return this.parseReturn();
    return this.parseExpressionStatement();
  }

  private parseBlock(): Node {
    this.consume('{');
    const body: Node[] = [];
    while (!this.match('}') && this.current.type !== 'eof') body.push(this.parseStatement());
    this.consume('}');
    return { kind: 'block', body };
  }

  private parseIf(): Node {
    this.consume('if');
    this.consume('(');
    const test = this.parseExpression(0);
    this.consume(')');
    const consequent = this.parseStatement();
    const alternate = this.match('else') ? (this.consume(), this.parseStatement()) : undefined;
    return { kind: 'if', test, consequent, alternate };
  }

  private parseDeclaration(): Node {
    this.consume();
    const name = this.consume();
    if (name.type !== 'ident') throw syntaxError('Nom de variable invalide.', name.position);
    this.consume('=');
    const value = this.parseExpression(0);
    if (this.match(';')) this.consume(';');
    else if (!this.match('}') && this.current.type !== 'eof') {
      throw syntaxError('Attendu « ; » après la déclaration.', this.current.position);
    }
    return { kind: 'assignment', name: name.value, value };
  }

  private parseReturn(): Node {
    this.consume('return');
    const value =
      this.match(';') || this.match('}') || this.current.type === 'eof'
        ? ({ kind: 'literal', value: undefined } as Node)
        : this.parseExpression(0);
    if (this.match(';')) {
      this.consume(';');
    } else if (!this.match('}') && this.current.type !== 'eof') {
      throw syntaxError('Attendu « ; » après return.', this.current.position);
    }
    return { kind: 'return', value };
  }

  private parseExpressionStatement(): Node {
    const expression = this.parseExpression(0);
    if (this.match(';')) {
      this.consume(';');
    } else if (!this.match('}') && this.current.type !== 'eof') {
      // Prevents malformed literals such as `1..2` from being parsed as two
      // adjacent expressions.
      throw syntaxError('Attendu « ; » après expression.', this.current.position);
    }
    return expression;
  }

  private parseExpression(minPrecedence: number): Node {
    let left = this.parseUnary();

    for (;;) {
      const operator = this.current.value;
      const precedence = BINARY_PRECEDENCE[operator];
      if (
        precedence !== undefined &&
        precedence >= minPrecedence &&
        this.current.type === 'punct'
      ) {
        this.consume();
        const right = this.parseExpression(precedence + 1);
        left =
          operator === '&&' || operator === '||' || operator === '??'
            ? { kind: 'logical', operator, left, right }
            : { kind: 'binary', operator, left, right };
        continue;
      }
      if (operator === '?' && minPrecedence === 0) {
        this.consume('?');
        const consequent = this.parseExpression(0);
        this.consume(':');
        const alternate = this.parseExpression(0);
        left = { kind: 'conditional', test: left, consequent, alternate };
        continue;
      }
      break;
    }
    return left;
  }

  private parseUnary(): Node {
    if (this.current.type === 'punct' && ['!', '-', '+'].includes(this.current.value)) {
      const operator = this.consume().value;
      return { kind: 'unary', operator, argument: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let expression = this.parsePrimary();
    for (;;) {
      if (this.match('.')) {
        this.consume('.');
        const property = this.consume();
        expression = {
          kind: 'member',
          object: expression,
          property: { kind: 'literal', value: property.value },
          position: property.position,
        };
      } else if (this.match('[')) {
        this.consume('[');
        const open = this.current;
        const property = this.parseExpression(0);
        this.consume(']');
        expression = { kind: 'member', object: expression, property, position: open.position };
      } else if (this.match('(')) {
        const open = this.consume('(');
        const args: Node[] = [];
        if (!this.match(')')) {
          do {
            args.push(this.parseExpression(0));
          } while (this.match(',') && this.consume());
        }
        this.consume(')');
        expression = { kind: 'call', callee: expression, args, position: open.position };
      } else {
        break;
      }
    }
    return expression;
  }

  private parsePrimary(): Node {
    const token = this.current;
    if (token.type === 'number') {
      this.consume();
      return { kind: 'literal', value: Number(token.value) };
    }
    if (token.type === 'string') {
      this.consume();
      return { kind: 'literal', value: token.value };
    }
    if (token.type === 'template') {
      this.consume();
      const parts = (token.parts || []).map((part) => {
        if (part.expr === undefined) return { text: part.text || '' };
        const subParser = new Parser(tokenize(part.expr));
        const statements = subParser.parse();
        if (statements.length !== 1) throw syntaxError('Interpolation invalide.');
        return { expr: statements[0] };
      });
      return { kind: 'template', parts };
    }
    if (token.type === 'ident') {
      this.consume();
      return { kind: 'identifier', name: token.value, position: token.position };
    }
    if (token.type === 'keyword') {
      this.consume();
      if (token.value === 'true') return { kind: 'literal', value: true };
      if (token.value === 'false') return { kind: 'literal', value: false };
      if (token.value === 'null' || token.value === 'undefined')
        return { kind: 'literal', value: undefined };
    }
    if (this.match('(')) {
      this.consume('(');
      const expression = this.parseExpression(0);
      this.consume(')');
      return expression;
    }
    if (this.match('{')) {
      this.consume('{');
      const entries: Array<{ key: string; value: Node }> = [];
      while (!this.match('}')) {
        const keyToken = this.consume();
        if (keyToken.type !== 'ident' && keyToken.type !== 'string' && keyToken.type !== 'number') {
          throw syntaxError("Clé d'objet invalide.", keyToken.position);
        }
        this.consume(':');
        entries.push({ key: keyToken.value, value: this.parseExpression(0) });
        if (this.match(',')) this.consume(',');
        else break;
      }
      this.consume('}');
      return { kind: 'object', entries };
    }
    if (this.match('[')) {
      this.consume('[');
      const items: Node[] = [];
      while (!this.match(']')) {
        items.push(this.parseExpression(0));
        if (this.match(',')) this.consume(',');
        else break;
      }
      this.consume(']');
      return { kind: 'array', items };
    }
    throw syntaxError(`Expression inattendue à la position ${token.position}.`, token.position);
  }
}

// Statement-only node kinds used internally by the parser.
type ProgramNode =
  Node | { kind: 'assignment'; name: string; value: Node } | { kind: 'return'; value: Node };

class ReturnSignal {
  constructor(readonly value: Value) {}
}

const STRING_METHODS: Record<string, (value: string, ...args: Value[]) => Value> = {
  toUpperCase: (v) => v.toUpperCase(),
  toLowerCase: (v) => v.toLowerCase(),
  trim: (v) => v.trim(),
  slice: (v, a, b) => v.slice(Number(a ?? 0), b === undefined ? undefined : Number(b)),
  substring: (v, a, b) => v.substring(Number(a ?? 0), b === undefined ? undefined : Number(b)),
  replace: (v, a, b) => v.replace(String(a), String(b)),
  replaceAll: (v, a, b) => v.split(String(a)).join(String(b)),
  includes: (v, a) => v.includes(String(a)),
  startsWith: (v, a) => v.startsWith(String(a)),
  endsWith: (v, a) => v.endsWith(String(a)),
  charAt: (v, a) => v.charAt(Number(a ?? 0)),
  indexOf: (v, a) => v.indexOf(String(a)),
  padStart: (v, a, b) => v.padStart(Math.min(MAX_PAD, Number(a ?? 0)), String(b ?? ' ')),
  padEnd: (v, a, b) => v.padEnd(Math.min(MAX_PAD, Number(a ?? 0)), String(b ?? ' ')),
  repeat: (v, a) => limitString(v.repeat(Math.min(MAX_REPEAT, Math.max(0, Number(a ?? 0))))),
  split: (v, a) => v.split(String(a ?? '')),
};

const ARRAY_METHODS: Record<string, (value: unknown[], ...args: Value[]) => Value> = {
  join: (v, a) => limitString(v.join(String(a ?? ','))),
  slice: (v, a, b) => v.slice(Number(a ?? 0), b === undefined ? undefined : Number(b)),
  includes: (v, a) => v.includes(a),
  indexOf: (v, a) => v.indexOf(a),
  concat: (v, ...args) => v.concat(...args),
  at: (v, a) => {
    const index = Number(a ?? 0);
    return index < 0 ? v[v.length + index] : v[index];
  },
};

const MATH_HELPERS: Record<string, Value> = {
  abs: (a: Value) => Math.abs(Number(a)),
  ceil: (a: Value) => Math.ceil(Number(a)),
  floor: (a: Value) => Math.floor(Number(a)),
  round: (a: Value) => Math.round(Number(a)),
  trunc: (a: Value) => Math.trunc(Number(a)),
  sign: (a: Value) => Math.sign(Number(a)),
  sqrt: (a: Value) => Math.sqrt(Number(a)),
  pow: (a: Value, b: Value) => Math.pow(Number(a), Number(b)),
  max: (...args: Value[]) => Math.max(...args.map(Number)),
  min: (...args: Value[]) => Math.min(...args.map(Number)),
  PI: Math.PI,
};

const GLOBALS: Record<string, Value> = {
  Number: (value?: Value) => Number(value ?? 0),
  String: (value?: Value) => String(value ?? ''),
  Boolean: (value?: Value) => Boolean(value),
  parseInt: (value: Value, radix?: Value) =>
    parseInt(String(value), radix === undefined ? 10 : Number(radix)),
  parseFloat: (value: Value) => parseFloat(String(value)),
  isNaN: (value: Value) => Number.isNaN(Number(value)),
  Math: MATH_HELPERS,
};

const BLOCKED_KEYS = new Set(['constructor', '__proto__', 'prototype', 'toString', 'valueOf']);

function memberValue(object: Value, key: Value, position?: number): Value {
  const property = String(key);
  if (BLOCKED_KEYS.has(property)) throw syntaxError(`Accès interdit à « ${property} ».`, position);

  if (typeof object === 'string') {
    if (property === 'length') return object.length;
    const method = STRING_METHODS[property];
    if (method) return (...args: Value[]) => method(object, ...args);
    return undefined;
  }
  if (Array.isArray(object)) {
    if (property === 'length') return object.length;
    const method = ARRAY_METHODS[property];
    if (method) return (...args: Value[]) => method(object, ...args);
  }
  if (
    object !== null &&
    typeof object === 'object' &&
    Object.prototype.hasOwnProperty.call(object, property)
  ) {
    return (object as Record<string, Value>)[property];
  }
  return undefined;
}

function evaluate(node: Node, scope: Map<string, Value>, state: EvalState): Value {
  tick(state);
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'identifier':
      if (scope.has(node.name)) return scope.get(node.name);
      if (Object.prototype.hasOwnProperty.call(GLOBALS, node.name)) return GLOBALS[node.name];
      throw syntaxError(`Variable inconnue « ${node.name} ».`, node.position);
    case 'assignment':
      scope.set(node.name, evaluate(node.value, scope, state));
      return undefined;
    case 'return':
      throw new ReturnSignal(evaluate(node.value, scope, state));
    case 'block': {
      let last: Value = undefined;
      for (const statement of node.body) {
        tick(state);
        last = evaluate(statement, scope, state);
      }
      return last;
    }
    case 'if':
      return evaluate(node.test, scope, state)
        ? evaluate(node.consequent, scope, state)
        : node.alternate
          ? evaluate(node.alternate, scope, state)
          : undefined;
    case 'template':
      return limitString(
        node.parts
          .map((part) =>
            part.expr ? String(evaluate(part.expr, scope, state) ?? '') : part.text || '',
          )
          .join(''),
      );
    case 'object': {
      const result: Record<string, Value> = Object.create(null);
      for (const entry of node.entries) {
        tick(state);
        result[entry.key] = evaluate(entry.value, scope, state);
      }
      return Object.freeze(result);
    }
    case 'array': {
      const items = node.items.map((item) => {
        tick(state);
        return evaluate(item, scope, state);
      });
      return Object.freeze(items);
    }
    case 'unary': {
      const value = evaluate(node.argument, scope, state);
      if (node.operator === '!') return !value;
      if (node.operator === '-') return -Number(value);
      return Number(value);
    }
    case 'binary': {
      const left = evaluate(node.left, scope, state) as never;
      const right = evaluate(node.right, scope, state) as never;
      switch (node.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '%':
          return left % right;
        case '===':
          return left === right;
        case '!==':
          return left !== right;
        case '==':
          return left == right;
        case '!=':
          return left != right;
        case '<':
          return left < right;
        case '>':
          return left > right;
        case '<=':
          return left <= right;
        case '>=':
          return left >= right;
        default:
          throw syntaxError(`Opérateur inconnu « ${node.operator} ».`);
      }
    }
    case 'logical': {
      const left = evaluate(node.left, scope, state);
      if (node.operator === '&&') return left ? evaluate(node.right, scope, state) : left;
      if (node.operator === '||') return left ? left : evaluate(node.right, scope, state);
      return left === undefined || left === null ? evaluate(node.right, scope, state) : left;
    }
    case 'conditional':
      return evaluate(node.test, scope, state)
        ? evaluate(node.consequent, scope, state)
        : evaluate(node.alternate, scope, state);
    case 'member':
      return memberValue(
        evaluate(node.object, scope, state),
        evaluate(node.property, scope, state),
        node.position,
      );
    case 'call': {
      const callee = evaluate(node.callee, scope, state);
      if (typeof callee !== 'function')
        throw syntaxError("Appel d'une valeur non callable.", node.position);
      return callee(...node.args.map((arg) => evaluate(arg, scope, state)));
    }
    default:
      throw syntaxError('Nœud de script inconnu.');
  }
}

/** Runs a render script in the restricted interpreter and returns its `return` value. */
export function interpretScript(script: string, context: Record<string, Value>): Value {
  const previousSource = currentScriptSource;
  currentScriptSource = script;
  try {
    const statements = new Parser(tokenize(script)).parse() as ProgramNode[];
    const scope = new Map<string, Value>();
    for (const [key, value] of Object.entries(context)) {
      if (BLOCKED_KEYS.has(key)) continue;
      scope.set(key, value);
    }
    const state: EvalState = { steps: MAX_STEPS };
    let lastValue: Value = undefined;
    for (const statement of statements) {
      tick(state);
      lastValue = evaluate(statement, scope, state);
    }
    return lastValue;
  } catch (error) {
    if (error instanceof ReturnSignal) return error.value;
    if (error instanceof ScriptSyntaxError && error.line && !error.message.includes('ligne')) {
      error.message = `${error.message} (ligne ${error.line})`;
    }
    throw error;
  } finally {
    currentScriptSource = previousSource;
  }
}
