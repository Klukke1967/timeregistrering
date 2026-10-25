const fs = require('fs');
const path = require('path');

const versionPath = path.join(__dirname, '..', 'public', 'version.json');
const pkgPath = path.join(__dirname, '..', 'package.json');

let version = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  version = pkg.version || version;
} catch (e) {}

const data = {
  version,
  buildTime: Date.now(),
  title: "Timeregistrering",
  updatedAt: new Date().toISOString(),
  notes: "Automatisk versionstjek, opdaterings-toast og direkte reload-knap"
};

fs.writeFileSync(versionPath, JSON.stringify(data, null, 2));
console.log('✓ public/version.json oprettet med buildTime:', data.buildTime);
