import { CardTemplatePack } from '../types/template';
import { validateTemplatePack } from '../utils/templateValidation';
import { downloadJsonFile, jsonFileName, readTextFile } from './fileIO';
import { DECK_FORMAT, FORMAT_VERSION, isObject, TEMPLATE_FORMAT } from './formats';

export interface TemplateSession {
  pack: CardTemplatePack;
  activeStyleKey: string;
  mode: 'card' | 'template';
}

/** Accepts the current format, old unwrapped packs and old single-style files. */
function normalizePackInput(input: unknown): unknown {
  if (!isObject(input)) return input;
  if (isObject(input.pack) && Array.isArray(input.pack.styles)) return input.pack;
  if (Array.isArray(input.fields) && !Array.isArray(input.styles)) {
    const name = typeof input.name === 'string' ? input.name : 'Template Importé';
    return {
      name,
      activeStyleKey: 'default',
      styles: [{ key: 'default', name, ...input }],
    };
  }
  return input;
}

function rejectOtherFormat(parsed: unknown): void {
  if (!isObject(parsed) || typeof parsed.format !== 'string') return;
  if (parsed.format === DECK_FORMAT) {
    throw new Error('Ce fichier contient un deck de cartes, pas un template.');
  }
  if (parsed.format !== TEMPLATE_FORMAT) {
    throw new Error(`Format de fichier non reconnu : ${parsed.format}.`);
  }
}

export function parseTemplateSessionJson(json: string): TemplateSession {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Fichier JSON invalide.');
  }
  rejectOtherFormat(parsed);

  const wrapper = isObject(parsed) ? parsed : {};
  const source =
    wrapper.format === TEMPLATE_FORMAT && isObject(wrapper.pack) ? wrapper.pack : parsed;
  const pack = validateTemplatePack(normalizePackInput(source));
  const candidateKey =
    typeof wrapper.activeStyleKey === 'string'
      ? wrapper.activeStyleKey
      : (isObject(source) && (source.activeStyleKey as string)) || '';
  const activeStyleKey = pack.styles.some((style) => style.key === candidateKey)
    ? candidateKey
    : pack.activeStyleKey || pack.styles[0].key;

  return {
    pack,
    activeStyleKey,
    mode: wrapper.mode === 'template' ? 'template' : 'card',
  };
}

export function serializeTemplateSession(session: TemplateSession): string {
  return JSON.stringify(
    {
      format: TEMPLATE_FORMAT,
      version: FORMAT_VERSION,
      pack: { ...session.pack, activeStyleKey: session.activeStyleKey },
      activeStyleKey: session.activeStyleKey,
      mode: session.mode,
    },
    null,
    2,
  );
}

export async function loadTemplateFile(file: File): Promise<TemplateSession> {
  return parseTemplateSessionJson(await readTextFile(file));
}

export function saveTemplateFile(session: TemplateSession): void {
  downloadJsonFile(jsonFileName(session.pack.name, 'template'), serializeTemplateSession(session));
}
