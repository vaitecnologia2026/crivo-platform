import fs from 'node:fs';
const mod = await import('pdf-parse');
const PDFParse = mod.PDFParse ?? mod.default?.PDFParse ?? mod.default;
for (const alvo of process.argv.slice(2)) {
  const p = new PDFParse({ data: fs.readFileSync(alvo) });
  try {
    const r = await p.getText();
    fs.writeFileSync(alvo.replace(/[^A-Za-z0-9]/g, '_').slice(-40) + '.txt', r.text);
    console.log('---> ' + alvo + ' :: ' + r.text.length + ' chars -> ' + alvo.replace(/[^A-Za-z0-9]/g, '_').slice(-40) + '.txt');
  } finally { await p.destroy?.(); }
}
