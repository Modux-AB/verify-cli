# Modux Verifier ‑ CLI

> **Verifiera att ett signerat Modux‑intyg är äkta – helt offline**
>
> * Hashar endast de **visuella strömmarna på första sidan**
> * Validerar Merkle‑beviset & återskapar roten

---

## 📦 Installation (Node ≥ 18)

```bash
# 1 ‑ klona repot
 git clone https://github.com/Modux-AB/verify-cli.git
 cd verify-cli

# 2 ‑ installera beroenden (endast pdf-lib)
 npm ci

# 3 ‑ gör skriptet körbart globalt (valfritt)
 npm link          # nu kan du köra `modux-verify` var som helst
```

> 💡 **Docker‑alternativ** (ingen Node behövs):
>
> ```bash
> docker build -t modux/verify-cli .  # en gång
> docker run --rm -v "$PWD:/work" modux/verify-cli signed.pdf proof.json
> ```

---

## 🚀 Snabbstart

1. **Hämta** det signerade intyget (`signed.pdf`).
2. **Spara** Merkle‑beviset från Modux‑portalen som `proof.json` – strukturen ser ut så här:

   ```json
   {
     "merkle_root": "4f4a769eae99…",
     "proof": [
       { "hash": "7542dc78e89b…", "left": false },
       { "hash": "6550217c9645…", "left": true  }
     ]
   }
   ```
3. **Kör verifieringen**:

   ```bash
   modux-verify signed.pdf proof.json
   ```

   <details>
   <summary>Exempel‑utskrift</summary>

   ```text
   • Fil‑hash:        2573ab37284d2b14753db5837d68e679dd2929b576c56e63421745f58a1a8e6b
   • Merkle‑root:     4f4a769eae9975eec72bb42f6878ac33c56ea6a67a118a0aa108d652ec170d7c
   ✅ Beviset är giltigt
   ```

   </details>

Om både **fil‑hashen** och **roten** stämmer har dokumentet inte förändrats sedan Modux signerade batchen via Bank‑ID.

> ⚠️ **OBS!** Det här verktyget antar att första sidans PDF-objekt är
> byte-identiska med originalet. Om du har öppnat och *sparat om* filen i
> t.ex. Förhandsvisning eller Adobe Acrobat kan hashvärdet ändras även om
> sidan *ser* likadan ut. Verifiera därför alltid originalet du laddade ned
> från Modux – eller be oss om en ny kopia.

---

## 🧑‍💻 CLI‑skriptets innehåll

`src/verify-modux.js` (ES Module):

```js
#!/usr/bin/env node
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { PDFDocument, PDFStream, PDFDict, PDFRef, decodePDFRawStream } from 'pdf-lib';

// ---------- hashFirstPageVisualStreams ----------
async function hashFirstPageVisualStreams(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  const ctx = doc.context;
  const page = doc.getPage(0);

  const seen = new Set();
  const stack = [page.node];
  const streams = [];

  const walk = obj => {
    if (!obj || seen.has(obj)) return;
    seen.add(obj);
    if (obj instanceof PDFStream) { streams.push(obj); walk(obj.dict); return; }
    if (obj instanceof PDFDict)   { for (const [,v] of obj.entries()) walk(v); return; }
    if (Array.isArray(obj))       { for (const v of obj) walk(v); return; }
    if (obj instanceof PDFRef)    walk(ctx.lookup(obj));
  };
  walk(page.node);

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
  if (merged.length === 0) merged = await doc.save();
  return crypto.createHash('sha256').update(merged).digest('hex');
}

// ---------- Merkle‑kontroll ----------
const sha256hex = str => crypto.createHash('sha256').update(str,'utf8').digest('hex');
function verifyMerkle(leaf, proof, root) {
  let cur = leaf.toLowerCase();
  proof.forEach(step => {
    cur = step.left ? sha256hex(step.hash + cur) : sha256hex(cur + step.hash);
  });
  return cur === root.toLowerCase();
}

// ---------- CLI ----------
const [,, pdfPath, proofPath] = process.argv;
if (!pdfPath || !proofPath) {
  console.error('Usage: modux-verify <signed.pdf> <proof.json>');
  process.exit(1);
}
const pdfBytes  = await fs.readFile(pdfPath);
const proofJson = JSON.parse(await fs.readFile(proofPath, 'utf8'));

const leafHash = await hashFirstPageVisualStreams(pdfBytes);
console.log('• Fil‑hash:   ', leafHash);
console.log('• Merkle‑root:', proofJson.merkle_root);

if (verifyMerkle(leafHash, proofJson.proof, proofJson.merkle_root)) {
  console.log('\u001b[32m✅ Beviset är giltigt\u001b[0m');
} else {
  console.log('\u001b[31m❌ Ogiltigt bevis\u001b[0m');
  process.exit(2);
}
```

---

## ⚖️ Licens

MIT © 2024 Modux AB
