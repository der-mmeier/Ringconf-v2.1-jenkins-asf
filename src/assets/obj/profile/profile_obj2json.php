<?php

namespace One;

use stdClass;

function convertOBJtoJSON(array $file): ?stdClass
{
  $json = new stdClass();
  $json->xzs = array_fill(0, 13, null); // index 12 = Kanal
  $json->size = array_fill(0, 13, null);

  $index = -1;
  $fb = 0;
  $xzs = null;

  $distance = function ($a, $b)
  {
    $x = $a->x - $b->x;
    $z = $a->z - $b->z;
    return sqrt($x * $x + $z * $z);
  };

  $xzsLength = function ($xzs) use ($distance)
  {
    $result = 0.0;
    $A = $xzs[0];

    for ($i = 1, $il = count($xzs); $i < $il; $i++)
    {
      $B = $xzs[$i];
      $result += $distance($A, $B);
      $A = $B;
    }

    return $result;
  };

  $xzsDims = function ($xzs) use ($xzsLength)
  {
    $minX = 99999.0;
    $minZ = 99999.0;
    $maxX = -99999.0;
    $maxZ = -99999.0;

    foreach ($xzs as $v)
    {
      if ($v)
      {
        if ($v->x < $minX) $minX = $v->x;
        if ($v->z < $minZ) $minZ = $v->z;
        if ($v->x > $maxX) $maxX = $v->x;
        if ($v->z > $maxZ) $maxZ = $v->z;
      }
    }

    $class = new stdClass();
    $class->cx = $maxX - $minX;
    $class->cz = $maxZ - $minZ;
    $class->length = $xzsLength($xzs);

    return $class;
  };

  foreach ($file as $line)
  {
    if (preg_match('#^o (.*?)$#', $line, $m))
    {
      $index = -1;

      if (preg_match('/segment_(\d+)([fb])/', $m[1], $out))
      {
        if ($out[1] >= 0 && $out[1] <= 12)
        {
          $index = $out[1];
          $fb = $out[2] == 'b' ? 1 : 0;
        }
      }

      $xzs = [];
    }
    else if ($index >= 0)
    {
      if (preg_match('#^v (.*?) (.*?) (.*?)$#', $line, $m))
      {
        $v = new stdClass();
        $v->x = (float)$m[1];
        $v->z = (float)$m[3];
        $v->s = $fb;
        $xzs[] = $v;
      }
      else if ($xzs && count($xzs) > 0)
      {
        $json->xzs[$index] = $xzs;
        $json->size[$index] = $xzsDims($xzs);
        $xzs = null;
        $index = -1;
        $fb = -1;
      }
    }
  }

  if ($json->xzs[1] != null)
  {
    $count = count($json->xzs[1]);
    if ($count < 3)
      echo "Segment 1 hat zu wenig Vertices!\n";
    if ($count % 2 == 0)
      echo "Segment 1 muss eine ungerade Anzahl an Vertices besitzen!\n";
  }

  if ($json->xzs[10] != null)
  {
    $count = count($json->xzs[10]);
    if ($count < 3)
      echo "Segment 10 hat zu wenig Vertices!\n";
    if ($count % 2 == 0)
      echo "Segment 10 muss eine ungerade Anzahl an Vertices besitzen!\n";
  }

  if ($json->xzs[12] != null)
  {
    $count = count($json->xzs[12]);
    if ($count < 3)
      echo "Segment 12 (Kanal) hat zu wenig Vertices!\n";
    if ($count % 2 == 0)
      echo "Segment 12 (Kanal) muss eine ungerade Anzahl an Vertices besitzen!\n";
  }

  return $json;
}

$dir = __DIR__;

$files = scandir($dir);

foreach ($files as $file)
{
  if (is_file($dir . DIRECTORY_SEPARATOR . $file) && preg_match('/(P(.*)).obj$/', $file, $m))
  {
    echo "try to convert $file...\n";
    $json = convertOBJtoJSON(file($dir . DIRECTORY_SEPARATOR . $file));
    if (!isset($json->error))
    {
      file_put_contents($dir . DIRECTORY_SEPARATOR . 'json' . DIRECTORY_SEPARATOR . $m[1] . '.json', json_encode($json));
      echo "ok\n====\n";
    }
    else
      echo $json->error . "\n";
  }
}
