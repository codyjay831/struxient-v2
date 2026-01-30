const patterns = [
  'export const PATCH = () => {}',
  'export async function PATCH(req) {}',
  'export { PATCH }',
  'export { GET, PATCH, POST }',
  'export { someFunc as PATCH }',
  'export { PATCH as something }', // Should NOT match
  'const PATCH = () => {}; export { PATCH }',
  '// export const PATCH = () => {}', // Should NOT match
  '/* export const PATCH = () => {} */', // Should NOT match
];

const method = 'PATCH';

function isMethodExported(content, method) {
  // Remove block comments
  const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '');
  
  const lines = cleanContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;

    // Simple exports: export const PATCH, export async function PATCH
    const simpleExport = new RegExp(`export\\s+(const|async\\s+function)\\s+${method}\\b`);
    if (simpleExport.test(trimmed)) return true;

    // Braced exports: export { PATCH }, export { a, b as PATCH }
    const bracedExport = /export\s+\{([^}]+)\}/g;
    let match;
    while ((match = bracedExport.exec(trimmed)) !== null) {
      const exports = match[1].split(',').map(e => e.trim());
      for (const exp of exports) {
        if (exp === method) return true;
        if (exp.endsWith(` as ${method}`)) return true;
      }
    }
  }
  return false;
}

patterns.forEach(p => {
  console.log(`Pattern: "${p}" -> Match: ${isMethodExported(p, method)}`);
});
