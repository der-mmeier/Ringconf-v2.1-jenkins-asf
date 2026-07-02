const browserslist = require('browserslist')
const fs = require('fs')
fs.writeFileSync('./src/php/browsers.json', JSON.stringify(browserslist()))
