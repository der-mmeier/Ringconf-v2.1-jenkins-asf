<?php
//$UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1";
//$UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 12_5_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/10.0 Mobile/15E148 Safari/602.1 MXiOS/6.0.4.144";
//$UA = "Mozilla/5.0 (iPhone; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3";
$UA = $_SERVER['HTTP_USER_AGENT'];
$browsers = json_decode(file_get_contents(__DIR__."/browsers.json"));

function getBrowser($u_agent = null)
{
  if ($u_agent == null)
    $u_agent = $_SERVER['HTTP_USER_AGENT'];

  $bname = 'Unknown';
  $platform = 'Unknown';
  $version = "";

  //First get the platform?
  if (preg_match('/linux/i', $u_agent))
  {
    $platform = 'linux';
  }
  elseif (preg_match('/macintosh|mac os x/i', $u_agent))
  {
    $platform = 'mac';
  }
  elseif (preg_match('/windows|win32/i', $u_agent))
  {
    $platform = 'windows';
  }

  // Next get the name of the useragent yes seperately and for good reason
  if (preg_match('/MSIE/i', $u_agent) && !preg_match('/Opera/i', $u_agent))
  {
    $bname = 'Internet Explorer';
    $ub = "MSIE";
  }
  elseif (preg_match('/Firefox/i', $u_agent))
  {
    $bname = 'Mozilla Firefox';
    $ub = "Firefox";
  }
  elseif (preg_match('/OPR/i', $u_agent))
  {
    $bname = 'Opera';
    $ub = "Opera";
  }
  elseif (preg_match('/Chrome/i', $u_agent) && !preg_match('/Edge/i', $u_agent))
  {
    $bname = 'Google Chrome';
    $ub = "Chrome";
  }
  elseif (preg_match('/Safari/i', $u_agent) && !preg_match('/Edge/i', $u_agent))
  {
    $bname = 'Apple Safari';
    $ub = "Safari";
  }
  elseif (preg_match('/Netscape/i', $u_agent))
  {
    $bname = 'Netscape';
    $ub = "Netscape";
  }
  elseif (preg_match('/Edge/i', $u_agent))
  {
    $bname = 'Edge';
    $ub = "Edge";
  }
  elseif (preg_match('/Trident/i', $u_agent))
  {
    $bname = 'Internet Explorer';
    $ub = "MSIE";
  }

  // finally get the correct version number
  $known = array('Version', $ub, 'other');
  $pattern = '#(?<browser>' . join('|', $known) .
    ')[/ ]+(?<version>[0-9.|a-zA-Z.]*)#';
  if (!preg_match_all($pattern, $u_agent, $matches))
  {
    // we have no matching number just continue
  }
  // see how many we have
  $i = count($matches['browser']);
  if ($i != 1)
  {
    //we will have two since we are not using 'other' argument yet
    //see if version is before or after the name
    if (strripos($u_agent, "Version") < strripos($u_agent, $ub))
    {
      $version = $matches['version'][0];
    }
    else
    {
      $version = $matches['version'][1];
    }
  }
  else
  {
    $version = $matches['version'][0];
  }

  // check if we have a number
  if ($version == null || $version == "")
  {
    $version = "?";
  }

  return array(
    'userAgent' => $u_agent,
    'name' => $ub,//$bname,
    'version' => $version,
    'platform' => $platform,
    'pattern' => $pattern
  );
}

// now try it
$ua = getBrowser($UA);
//$yourbrowser = $ua['name'] . " " . $ua['version'];// . $ua['userAgent'];
//print_r($yourbrowser);
//echo "<br/>";

$browserSupported = false;

foreach ($browsers as $item)
{
  $matches = [];
  if (preg_match("/" . $ua["name"] . "/i", $item, $matches) === 1)
  {
//    print_r($item);
//    echo "<br/>";

    if (preg_match("/(\d+\.?\d*)-?(\d+\.?\d*)?/", $item, $matches) === 1)
    {
      array_shift($matches);
//      print_r($matches);
//      echo "<br/>";

      $detectedVersion = floatval($ua["version"]);
      $supportedVersion = floatval($matches[0]);

      if ($detectedVersion >= $supportedVersion)
      {
//        echo "Browser wird unterstützt<br/>";
        $browserSupported = true;
        break;
      }
//      else {
//        echo "Browser wird <b>NICHT</b> unterstützt<br/>";
//      }
    }
  }
}

if ($browserSupported)
{
  echo file_get_contents(__DIR__."/index2.html");
}
else
{
  echo "Dieser Browser wird leider <b>nicht</b> unterst&uuml;tzt<br/>";
}


















/*
 * I found the existing answers didn't have a good success rate when tested against the possible user agent strings on this web page of example user agent strings:

http://www.webapps-online.com/online-tools/user-agent-strings/dv/operatingsystem51849/ios

I have created the following regex which has more success when tested against these examples:

(iPad|iPhone|iphone|iPod).*?(OS |os |OS\_)(\d+((_|\.)\d)?((_|\.)\d)?)
The fourth group contains the ios version number which is in the format x_y_z or x.y.z where y and z are optional.

There are 7 examples user agent strings which do not contain any version number so those particular ones are not matched. There is one example string where the ios version is "7.1" but the regex matches only the major version number "7" (this was good enough for my use case)

As well as the tests on the above page its also been tested against the ios10 agent strings listed on this page:

https://myip.ms/view/comp_browsers/1983/Safari_10.html
 */

//$matches =[];
//if (preg_match("/(iPad|iPhone|iphone|iPod).*?(OS |os |OS\_)(\d+((_|\.)\d)?((_|\.)\d)?)/", $UA, $matches) === 1)
//{
//  $version = preg_split("/_/", $matches[3]);
//  if (count($version) > 2)
//    array_pop($version);
//  $matches[3]=join(".", $version);
////  $matches[3]=preg_replace("/_/", ".", $matches[3]);
//
//  echo "<pre>";
//  print_r($matches);
//  echo "</pre>";
//}
//



