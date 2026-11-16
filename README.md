Modux Verifier – CLI (avvecklad)
Det här verktyget underhålls inte längre.

Kontrollera ett intyg
Gå till https://app.modux.se/verify, eller följ länken eller QR-koden på intyget, och välj eller dra in PDF-filen. Sidan jämför hela filen med den fil Modux utfärdade.

Du kan också göra jämförelsen själv. Räkna fram filens SHA-256, till exempel i en terminal:

shasum -a 256 intyg.pdf

Jämför värdet med "SHA-256 för utfärdad fil" under Teknisk verifiering på verifieringssidan. Är värdena lika är filen exakt den som utfärdades.

Licens
MIT © 2024 Modux AB

