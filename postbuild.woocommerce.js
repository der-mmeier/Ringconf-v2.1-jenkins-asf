let fs = require('fs');
const path = require('path');

function getFilesFromPath(dir, extension) {
  let files = fs.readdirSync(dir);
  return files.filter((e) => path.extname(e).toLowerCase() === extension);
}

// ==> modify asset path in css

// find the styles css file
let files = getFilesFromPath("_shop/woocommerce/OneRingconf/dist", '.css');
let assetPath = "url(/wp-content/plugins/OneRingconf/dist/assets/";

for (let f of files) {
  fs.readFile("_shop/woocommerce/OneRingconf/dist/" + f, "utf8", function (err, content) {
    content = content.replace(/url\(\/assets\//gm, assetPath);
    fs.writeFile("_shop/woocommerce/OneRingconf/dist/" + f, content, function (err)
    {
      if (err) throw err;
    })
  });
}

files = getFilesFromPath("_shop/woocommerce/OneRingconf/dist", '.js');

for (let f of files) {
  fs.readFile("_shop/woocommerce/OneRingconf/dist/" + f, "utf8", function (err, content) {
    content = content.replace(/url\(\/assets\//gm, assetPath);
    fs.writeFile("_shop/woocommerce/OneRingconf/dist/" + f, content, function (err)
    {
      if (err) throw err;
    })
  });
}

// ==> update version in plugin.xml
// fs.readFile(process.cwd() + '/package.json', "utf8",function (err, content)
// {
//   if (err) throw err;
//   let metadata = JSON.parse(content);
//   let version = metadata.version;
//   console.log("version: "+version);
//   fs.readFile("_shop/woocommerce/OneRingconf/plugin.xml", "utf8", function (err, content) {
//     content = content.replace(/<version>.*<\/version>/gm, "<version>"+version+"</version>");
//     fs.writeFile("_shop/woocommerce/OneRingconf/plugin.xml", content, function (err)
//     {
//       if (err) throw err;
//     })
//   });
// });

