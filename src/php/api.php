<?php

namespace One;
include "database.php";

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header("Access-Control-Allow-Headers: *");

use PDO;
use Throwable;
use stdClass;

const DATA_PATH = __DIR__ . '/data/';
const TABLE_APPDATA_BUILD = 'ringcfg_appdata_build';
const TABLE_APPDATA_VERSION = 'ringcfg_appdata_version';
const TABLE_APPDATA_COMPATIBILITY = 'ringcfg_appdata_build_compatibility';
const TABLE_APPDATA_TARGET = 'ringcfg_appdata_target';

new class {
  public function __construct()
  {
    $request = array_merge($_GET, $_POST);

    $rpc = !empty($request["rpc"]) ? $request["rpc"] : null;
    $rpp = !empty($request["rpp"]) ? json_decode($request["rpp"]) : array();

    if ($rpc != null) {
      if (is_callable([$this, $rpc])) {
        call_user_func_array([$this, $rpc], $rpp);
        die();
      }

      if (is_callable($rpc)) {
        call_user_func_array($rpc, $rpp);
        die();
      }
    }

//    if (!empty($_FILES)) {
//      ob_start();
//      var_dump($_FILES);
//      var_dump($_POST);
//      echo json_encode(ob_get_clean());
//    }

    die();
  }

  public function getDB()
  {
//    if (!empty($_POST["DB"]))
//      return $_POST["DB"];
    return new Database();
  }

  public function apiTestServer()
  {
    echo json_encode("apiTestServer ok");
  }

//  public function getJson($path)
//  {
//
//    if (is_file($path))
//      echo file_get_contents($path);
//    else
//      echo "";
//  }
  /**
   * Entfernt alle Einträge ohne json-Daten, die älter als 24 Stunden sind.
   */
  /*    public function clean_database()
      {
          $db = new Database();
          $db->query("DELETE FROM onercfg_preset WHERE preset_0 IS NULL AND preset_1 IS NULL AND date < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
      }*/

  public function dbGetId(): string
  {
    $id = $this->create_id();

    // keine json einfügen, Eintrag ist nur Platzhalter für die ID

    $db = $this->getDB();
    $db->query("INSERT INTO " . TABLE_PRESET . " (id) VALUES('$id')");

    $R = new stdClass();
    $R->id = $id;

    echo json_encode($R);
    return $id;
  }

  public function dbCheckIdExist($id)
  {
    $R = new stdClass();
    $R->result = 1;

    $db = $this->getDB();
    $stm = $db->query("SELECT COUNT(*) FROM " . TABLE_PRESET . " WHERE id = '$id'");

    if ($stm !== false) {
      if ($stm->fetchColumn() === 0) {
        $R->result = 0;
      }
    }

    echo json_encode($R);
  }

  public function dbGetAPPDATA($targetKey = null, $buildKey = null)
  {
    $db = $this->getDB();
    $targetKey = $this->resolveTargetKey($targetKey);
    $buildKey = $this->resolveBuildKey($buildKey);

    try {
      $resolved = $this->resolveVersionedAppData($db, $targetKey, $buildKey);
      if ($resolved !== null) {
        echo json_encode([
          'ok' => true,
          'data' => $resolved['snapshot'],
          'meta' => [
            'source' => 'versioned',
            'targetKey' => $targetKey,
            'buildKey' => $buildKey,
            'appDataVersionId' => $resolved['versionId'],
            'appDataVersionLabel' => $resolved['versionLabel'],
            'appDataHash' => $resolved['hash'],
          ],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return;
      }
    } catch (Throwable $error) {
      echo json_encode([
        'ok' => false,
        'data' => null,
        'meta' => [
          'source' => 'versioned',
          'targetKey' => $targetKey,
          'buildKey' => $buildKey,
        ],
        'error' => [
          'code' => 'APPDATA_RESOLUTION_FAILED',
          'message' => $error->getMessage(),
        ],
      ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
      return;
    }

    $stm = $db->query("SELECT `value` FROM " . TABLE_DATA . " WHERE `id`='appdata'");
    if ($stm->rowCount() === 1) {
      $data = $stm->fetch(PDO::FETCH_ASSOC);
      echo json_encode([
        'ok' => true,
        'data' => json_decode($data["value"], true),
        'meta' => [
          'source' => 'legacy',
          'targetKey' => $targetKey,
          'buildKey' => $buildKey,
          'appDataVersionId' => null,
          'appDataVersionLabel' => 'legacy',
          'appDataHash' => '',
        ],
      ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
  }

  private function resolveVersionedAppData(PDO $db, string $targetKey, string $buildKey): ?array
  {
    if (!$this->tableExists($db, TABLE_APPDATA_TARGET)
      || !$this->tableExists($db, TABLE_APPDATA_BUILD)
      || !$this->tableExists($db, TABLE_APPDATA_VERSION)
      || !$this->tableExists($db, TABLE_APPDATA_COMPATIBILITY)) {
      return null;
    }

    $target = $this->fetchTarget($db, $targetKey);
    if ($target === null) {
      return null;
    }

    $build = $this->fetchBuild($db, $buildKey);
    if ($build === null) {
      if ($target['active_appdata_version_id'] !== null) {
        throw new \RuntimeException('Build is not available for AppData resolution.');
      }
      return null;
    }

    if ((int)($target['locked_to_build'] ?? 0) === 1
      && $target['active_build_id'] !== null
      && (int)$target['active_build_id'] !== (int)$build['id']) {
      throw new \RuntimeException('Target is locked to a different build.');
    }

    if ($target['active_appdata_version_id'] !== null) {
      $version = $this->fetchVersion($db, (int)$target['active_appdata_version_id']);
      if ($version === null) {
        throw new \RuntimeException('Assigned AppData version was not found.');
      }
    } else {
      $version = $this->fetchLatestCompatibleVersion($db, (int)$build['id']);
      if ($version === null) {
        return null;
      }
    }

    if (($version['state'] ?? '') !== 'approved') {
      throw new \RuntimeException('Assigned AppData version is not approved.');
    }

    $compatibility = $this->fetchCompatibility($db, (int)$build['id'], (int)$version['id']);
    if (($compatibility['status'] ?? '') !== 'compatible') {
      throw new \RuntimeException('Assigned AppData version is not compatible with this build.');
    }

    $snapshot = json_decode((string)$version['snapshot_json'], true);
    if (!is_array($snapshot)) {
      throw new \RuntimeException('Assigned AppData snapshot is invalid.');
    }

    return [
      'snapshot' => $snapshot,
      'versionId' => (int)$version['id'],
      'versionLabel' => (string)$version['version_label'],
      'hash' => (string)$version['snapshot_hash'],
    ];
  }

  private function resolveTargetKey($targetKey): string
  {
    $explicit = $this->stringOrNull($targetKey)
      ?? $this->stringOrNull($_REQUEST['targetKey'] ?? null)
      ?? $this->stringOrNull($_REQUEST['target_key'] ?? null);
    if ($explicit !== null) {
      return $explicit;
    }

    $path = str_replace('\\', '/', __DIR__);
    if (str_contains($path, '/builds/development/')) {
      return 'local-development';
    }
    if (str_contains($path, '/builds/releases/')) {
      return 'default-production';
    }
    return 'default-production';
  }

  private function resolveBuildKey($buildKey): string
  {
    $explicit = $this->stringOrNull($buildKey)
      ?? $this->stringOrNull($_REQUEST['buildKey'] ?? null)
      ?? $this->stringOrNull($_REQUEST['build_key'] ?? null);
    if ($explicit !== null) {
      return $explicit;
    }

    $releaseJson = __DIR__ . '/release.json';
    if (is_file($releaseJson)) {
      $release = json_decode((string)file_get_contents($releaseJson), true);
      $version = $this->stringOrNull($release['version'] ?? null);
      if ($version !== null) {
        return $version;
      }
    }

    return 'unknown';
  }

  private function fetchTarget(PDO $db, string $targetKey): ?array
  {
    $stmt = $db->prepare('select * from ' . TABLE_APPDATA_TARGET . ' where target_key = :target_key and enabled = 1 limit 1');
    $stmt->execute(['target_key' => $targetKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
  }

  private function fetchBuild(PDO $db, string $buildKey): ?array
  {
    $stmt = $db->prepare('select * from ' . TABLE_APPDATA_BUILD . ' where build_key = :build_key and status = "available" limit 1');
    $stmt->execute(['build_key' => $buildKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
  }

  private function fetchVersion(PDO $db, int $versionId): ?array
  {
    $stmt = $db->prepare('
      select id, version_label, state, snapshot as snapshot_json, snapshot_sha256 as snapshot_hash
      from ' . TABLE_APPDATA_VERSION . '
      where id = :id
      limit 1
    ');
    $stmt->execute(['id' => $versionId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
  }

  private function fetchLatestCompatibleVersion(PDO $db, int $buildId): ?array
  {
    $stmt = $db->prepare('
      select v.id,
             v.version_label,
             v.state,
             v.snapshot as snapshot_json,
             v.snapshot_sha256 as snapshot_hash
      from ' . TABLE_APPDATA_VERSION . ' v
      inner join ' . TABLE_APPDATA_COMPATIBILITY . ' c on c.appdata_version_id = v.id
      where c.build_id = :build_id
        and c.status = "compatible"
        and v.state = "approved"
      order by v.version_major desc, v.version_minor desc, v.version_patch desc, v.version_revision desc, v.id desc
      limit 1
    ');
    $stmt->execute(['build_id' => $buildId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
  }

  private function fetchCompatibility(PDO $db, int $buildId, int $versionId): ?array
  {
    $stmt = $db->prepare('
      select * from ' . TABLE_APPDATA_COMPATIBILITY . '
      where build_id = :build_id and appdata_version_id = :version_id
      limit 1
    ');
    $stmt->execute(['build_id' => $buildId, 'version_id' => $versionId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
  }

  private function tableExists(PDO $db, string $table): bool
  {
    $stmt = $db->prepare('
      SELECT COUNT(*)
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table_name
  ');

    $stmt->execute([
      'table_name' => $table,
    ]);

    return (int)$stmt->fetchColumn() > 0;
  }

  private function stringOrNull($value): ?string
  {
    if (!is_string($value)) {
      return null;
    }
    $trimmed = trim($value);
    return $trimmed === '' ? null : $trimmed;
  }

  public function dbSetAPPDATA($data)
  {
    $db = $this->getDB();
    $db->query("INSERT INTO " . TABLE_DATA . " (id, value) VALUES('appdata', '$data') ON DUPLICATE KEY UPDATE value='$data'");
  }

  public function create_id(): string
  {
    $db = $this->getDB();

    $rand = function ($length = 4) {
      $characters = "23456789ABCDEFGHIJKLMNPQRSTUVWXYZ";
      $charactersLength = strlen($characters);
      $randomString = '';
      for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, $charactersLength - 1)];
      }
      return $randomString;
    };

    $id = $rand() . '-' . $rand();

    while (1) {
      $stm = $db->query("SELECT COUNT(*) FROM " . TABLE_PRESET . " WHERE id = '$id'");
      if ($stm !== false) {
        if ($stm->fetchColumn() === 0) {
          break;
        }
      }
      $id = $rand() . '-' . $rand();
    }

    return $id;
  }

  public function dbSavePreset($id, $preset_0, $preset_1, $imgData, $overwrite = false)
  {
    $db = $this->getDB();

    $preset_0 = json_encode($preset_0, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $preset_1 = json_encode($preset_1, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $imgData = json_encode($imgData);
    $incrase_id = false;

    $stm = $db->query("SELECT * FROM " . TABLE_PRESET . " WHERE id='$id'");

    if ($stm !== false) {
      if ($stm->rowCount() === 0) {
        $db->query("INSERT INTO " . TABLE_PRESET . " (id, preset_0, preset_1, img) VALUES('$id', '$preset_0', '$preset_1', '$imgData')");
      } else {
        $data = $stm->fetch(PDO::FETCH_NUM);
        if ($data[1] == null || $data[2] == null || $overwrite)
          $db->query("UPDATE " . TABLE_PRESET . " SET preset_0='$preset_0', preset_1='$preset_1', img='$imgData' WHERE id='$id'");
        else
          $incrase_id = true;
      }

    }

    if ($incrase_id) {
      while (1) {
        $stm = $db->query("SELECT COUNT(*) FROM " . TABLE_PRESET . " WHERE id = '$id'");
        if ($stm !== false) {
          if ($stm->fetchColumn() === 0) {
            break;
          }
        }

        if (strlen($id) === 9) {
          $id .= '-1';
        } else {
          $num = intval(substr($id, 10));
          $num++;
          $id = substr($id, 0, 10) . $num;
        }
      }

      $db->query("INSERT INTO " . TABLE_PRESET . " (id, preset_0, preset_1, img) VALUES('$id', '$preset_0', '$preset_1', '$imgData')");
    }

    $R = new stdClass();
    $R->errorCode = 0;
    $R->id = $id;
    $R->overwrite = $overwrite;
    echo json_encode($R);
  }

  public function dbLoadPreset($id)
  {
    $db = $this->getDB();
    $stm = $db->query("SELECT * FROM " . TABLE_PRESET . " WHERE id='$id'");
    $R = new stdClass();
    $R->errorCode = 0;
    $R->info = "";
    $R->id = $id;

    $loadDefaults = function ($id) use ($stm, $db, $R) {
      $stm = $db->query("SELECT * FROM " . TABLE_PRESET . " WHERE id='0000-0000'");
      if ($stm->rowCount() !== 1) {
        $R->errorCode = -1;
        $R->info = "Kein Standardpreset vorhanden";
        return;
      }

      $db->query("INSERT INTO " . TABLE_PRESET . " (id) VALUES('$id')");

      $R->errorCode = -2;
      $R->info = "Preset nicht gefunden! Es wurde das Standardpreset geladen.";
      $data = $stm->fetch(PDO::FETCH_ASSOC);
      $R->preset_0 = $data["preset_0"];
      $R->preset_1 = $data["preset_1"];
      $R->img = $data["img"];
    };

    if ($stm->rowCount() === 1) {
      $data = $stm->fetch(PDO::FETCH_ASSOC);

      // DB Eintrag ist vorhanden, aber keine Daten hinterlegt. Siehe dbGetId()
      // lade Standardpreset...
      if ($data["preset_0"] == NULL || $data["preset_1"] == NULL) {
        $R->id = $this->create_id();
        $loadDefaults($R->id);
      } else {
        $R->preset_0 = $data["preset_0"];
        $R->preset_1 = $data["preset_1"];
        $R->img = $data["img"];

        $id = substr($id, 0, 9);
        $stm = $db->query("SELECT id FROM " . TABLE_PRESET . " WHERE id LIKE '$id%'"/*, PDO::FETCH_NUM*/);

        if ($stm != FALSE) {
          $R->dbItems = $stm->fetchAll();
        }
      }
    } else {
      $loadDefaults($id);
    }

    echo json_encode($R);
  }

  public function calcPrice($preset)
  {
//    $PRICE = 0.0;
//
//    try {
//      $db = $this->getDB();
//      $doAsfBackup = true;
//
//      Legacy price database connection removed; use the configured Database instance.
//        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
//      ));
//
//      $profileNr = intval(substr($preset->_profileName, 1));
//      $dbRes = $pdo->query("SELECT * FROM profile_prices WHERE profile='$profileNr'");
//      if ($dbRes !== false && $dbRes->rowCount() > 0)
//        $asf = $dbRes->fetchAll();
//      else { // suche nach Backup der Preisliste
//        $doAsfBackup = false;
//        $dbRes = $db->query("SELECT `value` FROM " . TABLE_DATA . " WHERE `id`='asfdata'");
//
//        if ($dbRes !== false && $dbRes->rowCount() == 1)
//          $asf = json_decode($dbRes->fetch(PDO::FETCH_ASSOC)["value"]);
//        else
//          throw new \Exception('No AsfData');
//      }
//
//      file_put_contents(__DIR__."/asf.json", json_encode($asf));
//
//      if ($doAsfBackup)
//        $db->query("INSERT INTO " . TABLE_DATA . " (id, value) VALUES('asfdata', '" . json_encode($asf) . "') ON DUPLICATE KEY UPDATE value='" . json_encode($asf) . "'");
//
//      $dbRes = $db->query("SELECT `value` FROM " . TABLE_DATA . " WHERE `id`='appdata'");
//      if ($dbRes !== false && $dbRes->rowCount() == 1)
//        $appdata = json_decode($dbRes->fetch(PDO::FETCH_ASSOC)["value"]);
//      else
//        throw new \Exception('No AppData');
//
//      $matCount = count($preset->_materialDiv);
//
//      $materialArray = $preset->_material;
//      $finenessArray = $preset->_fineness;
//      $surfaceArray = $preset->_surface;
//
//      $area = $preset->_ringWidth * $preset->_ringHeight;
//
//      $materialDivSum = array_sum($preset->_materialDiv);
//
//      // Wenn Weißgold Verwendung findet, ist ein entsprechender Aufschlag auf den Material-Grammpreis vorzunehmen.
//      $hasWhitegold = false;
//
//      for ($i = 0; $i < $matCount; $i++) {
//        if ($materialArray[$i] == 1) {
//          $hasWhitegold = true;
//          break;
//        }
//      }
//
//      $materialSurcharge = 0.0;
//      if ($hasWhitegold) $materialSurcharge = 1.0; // kompletter Ring in Weißgold: Aufschlag 1,-€ auf den Grammpreis
//      if ($hasWhitegold && $matCount > 1) $materialSurcharge = 3.0;// mehrfarbiger Ring mit Weißgold-Anteil: Aufschlag 3,-€ auf den Grammpreis
//
//      $hasGold = false;
//      $hasPT600 = false;
//      $hasPT950 = false;
//      $hasPD585 = false;
//      $hasPD950 = false;
//
//      $surfaceSurchargeMax = 0.0; // Der größte Oberflächenaufschlag wird dem Endpreis hinzuaddiert.
//
//      for ($i = 0; $i < $matCount; $i++) {
//        $material = $appdata->material[$materialArray[$i]];
//        $finenessIndex = array_search($finenessArray[$i], $material->fineness);
//
//        $asfProfileIndex = $material->asfProfileIndex[$finenessIndex];
//        $asfProfileFactor = floatval($asf[0][$asfProfileIndex]);
//
//        $materialAmount = $preset->_materialDiv[$i] / $materialDivSum;
//        $materialFactor = ($asfProfileFactor / 55.0 / 5.0 / 1.5) * $materialAmount;
//
//        $mass = $area * $materialFactor * 60.0; // Die Ringgröße wird ignoriert
//        $gramm = $finenessArray[$i] / 1000 * $material->pricePerGramm + $material->processingFee[$finenessIndex] + $materialSurcharge;
//
//        $PRICE += ($mass * $gramm * $material->calcFactor) / 1000000; // 100000 = ringWidth und ringHeight werden mit Faktor 1000 angegeben...
//
//        $surface = $appdata->surface[$surfaceArray[$i]];
//
//        if (isset($surface->surcharge)) {
//          if ($surface->surcharge > $surfaceSurchargeMax)
//            $surfaceSurchargeMax = $surface->surcharge;
//        }
//
//        if ($materialArray[$i] <= 3) $hasGold = true;
//
//        if ($materialArray[$i] == 4) {
//          if ($finenessArray[$i] == 600) $hasPT600 = true;
//          else if ($finenessArray[$i] == 950) $hasPT950 = true;
//        }
//
//        if ($materialArray[$i] == 5) {
//          if ($finenessArray[$i] == 585) $hasPD585 = true;
//          else if ($finenessArray[$i] == 950) $hasPD950 = true;
//        }
//      }
//
//      $PRICE += $surfaceSurchargeMax; // nur 1 mal den Oberflächenaufschlag
//
//      // nachfragen, ob das so richtig ist...
//      if ($hasGold && $hasPT600) $PRICE += 100.0;
//      if ($hasGold && $hasPD585) $PRICE += 150.0;
//      if ($hasGold && $hasPT950) $PRICE += 200.0;
//      if ($hasGold && $hasPD950) $PRICE += 250.0;
//
//      // => Steine
//      $getStoneSizeObject = function ($type, $size) use ($appdata) {
//        $i = 0;
//        while (true) {
//          if ($appdata->stoneType[$i]->id == $type)
//            break;
//          $i++;
//          if ($i >= count($appdata->stoneType)) {
//            $i = -1;
//            break;
//          }
//        }
//
//        if ($i >= 0) {
//          $t = $appdata->stoneType[$i];
//
//          for ($i = 0, $li = count($t->size); $i < $li; $i++) {
//            if ($t->size[$i]->size == $size)
//              return $t->size[$i];
//          }
//        }
//        return null;
//      };
//
//      $stoneGroups = $preset->_stone;
//      for ($i = 0, $li = count($stoneGroups); $i < $li; $i++) {
//        $stoneGroup = $stoneGroups[$i];
//
//        if ($stoneGroup->mode == 0)
//          continue;
//
//        $p = 0;
//        if ($stoneGroup->mode == 11) // freie Steine
//        {
//          $freeStones = $stoneGroup->freeStones;
//          for ($j = 0, $lj = count($freeStones); $j < $lj; $j++) {
//            $stoneSizeObject = $getStoneSizeObject($stoneGroup->type, $freeStones[$j]->size);
//            if ($stoneGroup->quality == 3) { // Zirkonia wird gestaffelt und ohne Faktor berechnet
//              $p = ($stoneSizeObject->price[3] * $stoneSizeObject->carat + $stoneSizeObject->surcharge); // ohne Faktor
//            } else {
//              $p = ($stoneSizeObject->price[$stoneGroup->quality] * $stoneSizeObject->carat + $stoneSizeObject->surcharge) * $stoneSizeObject->priceFactor;
//            }
//
//            $PRICE += $p;
//          }
//        } else {
//          $stoneSizeObject = $getStoneSizeObject($stoneGroup->type, $stoneGroup->size);
//
//          $count = $stoneGroup->countReal * $stoneGroup->rows;
//
//          if ($stoneGroup->quality == 3) { // Zirkonia wird gestaffelt und ohne Faktor berechnet
//
//            $p = ($stoneSizeObject->price[3] * $stoneSizeObject->carat + $stoneSizeObject->surcharge); // ohne Faktor
//            $p *= $count;
//
//            if ($count >= 30) $p *= 0.25;
//            else if ($count >= 20) $p *= 0.5;
//            else if ($count >= 10) $p *= 0.75;
//          } else {
//            $p = ($stoneSizeObject->price[$stoneGroup->quality] * $stoneSizeObject->carat + $stoneSizeObject->surcharge) * $stoneSizeObject->priceFactor;
//            $p *= $count;
//          }
//        }
//
//        $PRICE += $p;
//      }
//      // <= Steine
//
//      $PRICE = ceil($PRICE / 5) * 5;
//
//    } catch (PDOException $pe) {
//      $PRICE = 9999.99;
//    }

    $R = new stdClass();
    $R->price = 9999.99;
//    $R->price = $PRICE;
    echo json_encode($R);
  }

//  public function createStoneDB()
//  {
//    $stones = json_decode(file_get_contents(__DIR__ . "/data/stone - original.json"));
//    $db = new Database();
//
//    for ($i = 1, $il = count($stones); $i < $il; $i++)
//    {
//
//      for ($j = 0, $jl = count($stones[$i]->list); $j < $jl; $j++)
//      {
//
//        $item = $stones[$i]->list[$j];
//        $db->query("INSERT INTO " . TABLE_STONE . " (type, name, size, carat, price_q0, price_q1, price_q2, price_q3, pricefactor, surcharge) VALUES({$i}, '{$stones[$i]->name}', {$item->s}, {$item->c}, {$item->p[0]}, {$item->p[1]}, {$item->p[2]}, {$item->p[3]}, {$item->f}, {$item->sc})");
//      }
//    }
//  }

  public function uploadFile($path, $filename, $formDataSelector)
  {
//    if (move_uploaded_file($_FILES[$formDataSelector]["tmp_name"], __DIR__.'/assets/img3d/' . $filename)) {

    if (move_uploaded_file($_FILES[$formDataSelector]["tmp_name"], __DIR__ . $path . $filename)) {
      echo json_encode("The file " . htmlspecialchars(basename($_FILES[$formDataSelector]["name"])) . " has been uploaded.");
      return;
    }

    echo json_encode("Sorry, there was an error uploading your file.");
  }

  public function restoreEnvTexture()
  {
    $result = copy(__DIR__ . '/assets/img3d/envTexture.env.bak', __DIR__ . '/assets/img3d/envTexture.env');

    $R = new stdClass();
    $R->errorCode = $result ? 0 : 1;

    echo json_encode($R);
  }

  public function dbSaveEnvironmentPreset($name, $preset)
  {
    $db = $this->getDB();
    $name = "env_" . $name;

//    $preset = json_encode($preset, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $stm = $db->query("SELECT * FROM " . TABLE_DATA . " WHERE id='$name'");

    if ($stm !== false) {
      if ($stm->rowCount() === 0)
        $db->query("INSERT INTO " . TABLE_DATA . " (id, value) VALUES('$name', '$preset')");
      else
        $db->query("UPDATE " . TABLE_DATA . " SET value='$preset' WHERE id='$name'");
    }

    $R = new stdClass();
    $R->errorCode = 0;
    echo json_encode($R);
  }

  public function dbGetEnvironmentPresetList()
  {
    $db = $this->getDB();

    $stm = $db->query("SELECT * FROM " . TABLE_DATA . " WHERE id LIKE 'env_%'");


    $result = [];

    if ($stm !== false) {
      $result = $stm->fetchAll(PDO::FETCH_ASSOC);
    }

    $R = new stdClass();
    $R->errorCode = 0;
    $R->result = $result;
    echo json_encode($R);

  }
};


