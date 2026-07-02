let fs = require('fs');
fs.readFile(process.cwd() + '/package.json', "utf8",function (err, content)
{
  if (err) throw err;
  let metadata = JSON.parse(content);
  let version = metadata.version;
  let versionAr = version.split(".");
  let build = parseInt(versionAr[versionAr.length - 1]);
  build++;
  versionAr[versionAr.length - 1] = "" + build;

  metadata.version = versionAr.join(".");
  console.log("Current Build:"+metadata.version);
  fs.writeFile(process.cwd() + '/package.json', JSON.stringify(metadata, null, 2), function (err)
  {
    if (err) throw err;
  })
});
