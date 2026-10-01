// Edit src/data/descriptions.ts in place: change the entries named in
// `patches` and leave every other byte alone. The admin used to regenerate
// the whole file from the circumplex-custom words, which dropped every
// definition that only the active framework (radial-intensity) uses, along
// with the helpers below the object. Pure, so scripts/test-patch-descriptions.ts
// can check it; the dev-server plugin (src/plugins/admin-save.ts) does the I/O.
//
// Relies on the file's one-entry-per-key shape:
//   key: {
//     description: "…",
//     relatedIds: ['…'],
//   },

export interface DescriptionPatch {
  description?: string;
  relatedIds?: string[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A bare key when it is a valid identifier, else single-quoted (e.g. 'burned-out').
function keyOf(id: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(id) ? id : `'${id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// JSON's double-quoted strings are valid TS string literals, escapes included.
const literal = (s: string) => JSON.stringify(s);
const relatedLiteral = (ids: string[]) => `[${ids.map((id) => `'${id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')}]`;

export function patchDescriptions(source: string, patches: Record<string, DescriptionPatch>): string {
  let out = source;
  const inserts: string[] = [];

  for (const [id, patch] of Object.entries(patches)) {
    const key = `(?:${escapeRe(id)}|'${escapeRe(id)}'|"${escapeRe(id)}")`;
    const entryRe = new RegExp(`^  ${key}: \\{\\n([\\s\\S]*?)^  \\},?$`, 'm');
    const match = entryRe.exec(out);

    if (match) {
      let body = match[1];
      if (patch.description !== undefined) {
        body = body.replace(/^ {4}description: .*$/m, `    description: ${literal(patch.description)},`);
      }
      if (patch.relatedIds !== undefined) {
        body = body.replace(/^ {4}relatedIds: .*$/m, `    relatedIds: ${relatedLiteral(patch.relatedIds)},`);
      }
      const start = match.index + match[0].indexOf(match[1]);
      out = out.slice(0, start) + body + out.slice(start + match[1].length);
      continue;
    }

    // No entry yet: add one only if it would say something.
    const description = patch.description ?? '';
    const relatedIds = patch.relatedIds ?? [];
    if (description.trim() === '' && relatedIds.length === 0) continue;
    inserts.push(
      `  ${keyOf(id)}: {\n    description: ${literal(description)},\n    relatedIds: ${relatedLiteral(relatedIds)},\n  },`,
    );
  }

  if (inserts.length > 0) {
    const objectStart = out.indexOf('export const descriptions');
    const objectEnd = objectStart === -1 ? -1 : out.indexOf('\n};', objectStart);
    if (objectEnd === -1) throw new Error('descriptions.ts: could not find the end of the descriptions object');
    out = `${out.slice(0, objectEnd)}\n${inserts.join('\n')}${out.slice(objectEnd)}`;
  }

  return out;
}
