#!/usr/bin/env node
// node verify-modux.js <PDF-fil> <proof.json>

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { PDFDocument, PDFStream, PDFDict, PDFRef, decodePDFRawStream } from 'pdf-lib';

/* ---------- 1. hashFirstPageVisualStreams (samma som i webben) ---------- */
async function hashFirstPageVisualStreams(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  const ctx = doc.context;
  const page = doc.getPage(0);

  const seen = new Set(), stack = [page.node], streams = [];
  const visit = obj => {
    if (!obj || seen.has(obj)) return;
    seen.add(obj);

    if (obj instanceof PDFStream) { streams.push(obj); visit(obj.dict); return; }
    if (obj instanceof PDFDict)    { for (const [,v] of obj.entries()) visit(v); return; }
    if (Array.isArray(obj))        { for (const v of obj) visit(v); return; }
    if (obj instanceof PDFRef)     visit(ctx.lookup(obj));
  };
  visit(page.node);

  streams.sort((a,b)=>{
    const [na,ga]=a.dict.objId??[0,0], [nb,gb]=b.dict.objId??[0,0];
    return na-nb || ga-gb;
  });

  let merged = new Uint8Array();
  for (const s of streams) {
    const decoded = decodePDFRawStream(s).decode();
    const tmp = new Uint8Array(merged.length + decoded.length);
    tmp.set(merged); tmp.set(decoded, merged.length); merged = tmp;
  }
  if (merged.length === 0) merged = await doc.save();              // blank-sida fallback

  const h = crypto.createHash('sha256').update(merged).digest('hex');
  return h;
}

/* ---------- 2. Merkle-verifiering ---------- */
function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}
function verifyMerkle(leaf, proof, root) {
  let current = leaf.toLowerCase();
  proof.forEach(step => {
    current = step.left
      ? sha256Hex(step.hash + current)
      : sha256Hex(current + step.hash);
  });
  return current === root.toLowerCase();
}

/* ---------- 3. CLI ---------- */
const [ , , pdfPath, proofPath ] = process.argv;
if (!pdfPath || !proofPath) {
  console.error('Usage: verify-modux.js <signed.pdf> <proof.json>');
  process.exit(1);
}
const pdfBytes   = await fs.readFile(pdfPath);
const proofJson  = JSON.parse(await fs.readFile(proofPath, 'utf8'));

const leafHash   = await hashFirstPageVisualStreams(pdfBytes);
const rootOk     = verifyMerkle(leafHash, proofJson.proof, proofJson.merkle_root);

console.log('• Fil-hash:', leafHash);
console.log('• Merkle-root i beviset:', proofJson.merkle_root);
console.log(rootOk ? '✅ Beviset är giltigt' : '❌ Ogiltigt bevis');
