// Keep the downloadable HTML self-contained while retaining readable sources.
const fs = require('node:fs');
const path = require('node:path');
const file = name => path.join(__dirname, name);
let html = fs.readFileSync(file('index.html'), 'utf8');
const css = fs.readFileSync(file('style.css'), 'utf8');
const js = ['core.js', 'onedrive.js', 'app.js'].map(name => fs.readFileSync(file(name), 'utf8')).join('\n');
html = html.replace(/<style id="treesizer-styles">[\s\S]*?<\/style>/, () => `<style id="treesizer-styles">\n${css}\n</style>`);
html = html.replace(/<script id="treesizer-app">[\s\S]*?<\/script>/, () => `<script id="treesizer-app">\n${js}\n</script>`);
fs.writeFileSync(file('index.html'), html);
