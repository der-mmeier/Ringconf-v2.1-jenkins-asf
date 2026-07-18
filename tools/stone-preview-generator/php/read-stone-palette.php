<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    fwrite(STDERR, "This adapter is available only on the PHP CLI.\n");
    exit(2);
}

require_once dirname(__DIR__, 3) . '/src/php/config.php';

const TABLE_APPDATA_BUILD = 'ringcfg_appdata_build';
const TABLE_APPDATA_VERSION = 'ringcfg_appdata_version';
const TABLE_APPDATA_COMPATIBILITY = 'ringcfg_appdata_build_compatibility';
const TABLE_APPDATA_TARGET = 'ringcfg_appdata_target';

try {
    $options = parseOptions(array_slice($argv, 1));
    $db = openReadOnlyDatabase();
    $resolved = resolveAppData($db, $options);
    $palette = normalizePalette($resolved);
    echo json_encode($palette, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
} catch (Throwable $error) {
    fwrite(STDERR, "ERROR: " . safeError($error->getMessage()) . "\n");
    exit(1);
}

function parseOptions(array $args): array
{
    $options = [
        'target' => 'default-production',
        'build' => null,
        'version' => null,
        'state' => 'approved',
    ];

    foreach ($args as $arg) {
        if (!str_starts_with($arg, '--')) {
            throw new RuntimeException('Invalid argument.');
        }
        [$key, $value] = array_pad(explode('=', substr($arg, 2), 2), 2, '');
        if (!array_key_exists($key, $options)) {
            throw new RuntimeException('Unsupported option: --' . $key);
        }
        $options[$key] = trim($value);
    }

    if ($options['state'] !== 'approved' && $options['state'] !== 'draft') {
        throw new RuntimeException('Unsupported state. Use approved or draft.');
    }

    return $options;
}

function openReadOnlyDatabase(): PDO
{
    if (!defined('DB_DSN') || DB_DSN === '') {
        throw new RuntimeException('Database configuration is missing.');
    }

    return new PDO(DB_DSN, DB_USERNAME, DB_PASSWORD, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function resolveAppData(PDO $db, array $options): array
{
    if ($options['version'] !== null && $options['version'] !== '') {
        return fetchVersionByLabelOrId($db, (string)$options['version'], (string)$options['state']);
    }

    $target = fetchTarget($db, (string)$options['target']);
    if ($target !== null && $target['active_appdata_version_id'] !== null) {
        $version = fetchVersionById($db, (int)$target['active_appdata_version_id']);
        if ($version === null || ($version['state'] ?? '') !== $options['state']) {
            throw new RuntimeException('Active target AppData version is not in the requested state.');
        }
        return decodeVersion($version, (string)$options['target'], $target['build_key'] ?? null, 'target-active');
    }

    $buildKey = $options['build'] ?: readPackageVersion();
    $build = fetchBuild($db, $buildKey);
    if ($build === null) {
        throw new RuntimeException('No active target version and no compatible build record found.');
    }

    $version = fetchLatestCompatibleVersion($db, (int)$build['id'], (string)$options['state']);
    if ($version === null) {
        throw new RuntimeException('No compatible AppData version was found for the selected build.');
    }
    return decodeVersion($version, (string)$options['target'], $buildKey, 'build-compatible');
}

function readPackageVersion(): string
{
    $path = dirname(__DIR__, 3) . '/package.json';
    $decoded = json_decode((string)file_get_contents($path), true);
    if (!is_array($decoded) || empty($decoded['version'])) {
        throw new RuntimeException('Could not resolve package version.');
    }
    return (string)$decoded['version'];
}

function fetchTarget(PDO $db, string $targetKey): ?array
{
    $stmt = $db->prepare('
        select t.*, b.build_key
        from ' . TABLE_APPDATA_TARGET . ' t
        left join ' . TABLE_APPDATA_BUILD . ' b on b.id = t.active_build_id
        where t.target_key = :target_key and t.enabled = 1
        limit 1
    ');
    $stmt->execute(['target_key' => $targetKey]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function fetchBuild(PDO $db, string $buildKey): ?array
{
    $stmt = $db->prepare('select * from ' . TABLE_APPDATA_BUILD . ' where build_key = :build_key and status = "available" limit 1');
    $stmt->execute(['build_key' => $buildKey]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function fetchVersionById(PDO $db, int $id): ?array
{
    $stmt = $db->prepare('
        select id, version_label, state, snapshot as snapshot_json, snapshot_sha256 as snapshot_hash
        from ' . TABLE_APPDATA_VERSION . '
        where id = :id
        limit 1
    ');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function fetchVersionByLabelOrId(PDO $db, string $value, string $state): array
{
    $where = ctype_digit($value) ? 'id = :value' : 'version_label = :value';
    $stmt = $db->prepare('
        select id, version_label, state, snapshot as snapshot_json, snapshot_sha256 as snapshot_hash
        from ' . TABLE_APPDATA_VERSION . '
        where ' . $where . ' and state = :state
        limit 1
    ');
    $stmt->execute(['value' => $value, 'state' => $state]);
    $row = $stmt->fetch();
    if (!$row) {
        throw new RuntimeException('Requested AppData version was not found.');
    }
    return decodeVersion($row, '', null, 'explicit-version');
}

function fetchLatestCompatibleVersion(PDO $db, int $buildId, string $state): ?array
{
    $stmt = $db->prepare('
        select v.id, v.version_label, v.state, v.snapshot as snapshot_json, v.snapshot_sha256 as snapshot_hash
        from ' . TABLE_APPDATA_VERSION . ' v
        inner join ' . TABLE_APPDATA_COMPATIBILITY . ' c on c.appdata_version_id = v.id
        where c.build_id = :build_id
          and c.status = "compatible"
          and v.state = :state
        order by v.version_major desc, v.version_minor desc, v.version_patch desc, v.version_revision desc, v.id desc
        limit 1
    ');
    $stmt->execute(['build_id' => $buildId, 'state' => $state]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function decodeVersion(array $version, string $targetKey, ?string $buildKey, string $source): array
{
    $snapshot = json_decode((string)$version['snapshot_json'], true);
    if (!is_array($snapshot)) {
        throw new RuntimeException('AppData snapshot is invalid.');
    }

    return [
        'source' => $source,
        'targetKey' => $targetKey,
        'buildKey' => $buildKey,
        'versionLabel' => (string)$version['version_label'],
        'snapshotHash' => (string)$version['snapshot_hash'],
        'snapshot' => $snapshot,
    ];
}

function normalizePalette(array $resolved): array
{
    $snapshot = $resolved['snapshot'];
    $colors = is_array($snapshot['stoneColor'] ?? null) ? $snapshot['stoneColor'] : [];
    $usedIds = resolveUsedColorIds($snapshot);
    $normalized = [];

    foreach ($colors as $color) {
        if (!is_array($color)) {
            continue;
        }
        $id = trim((string)($color['id'] ?? ''));
        if ($id === '' || (($color['enabled'] ?? true) === false) || ($usedIds !== null && !in_array($id, $usedIds, true))) {
            continue;
        }
        $hex = normalizeHexValue($color['hex'] ?? null);
        $normalized[] = [
            'id' => $id,
            'label' => (string)($color['name'] ?? $id),
            'enabled' => true,
            'sortOrder' => is_numeric($color['sort'] ?? null) ? (int)$color['sort'] : 0,
            'sourceColor' => [
                'format' => 'hex',
                'originalField' => 'stoneColor.hex',
                'previewHex' => $hex,
            ],
            'explicitPreviewAsset' => previewAsset($color),
        ];
    }

    usort($normalized, static function (array $a, array $b): int {
        return [$a['sortOrder'], $a['id']] <=> [$b['sortOrder'], $b['id']];
    });

    return [
        'schemaVersion' => 1,
        'source' => $resolved['source'],
        'targetKey' => $resolved['targetKey'],
        'buildKey' => $resolved['buildKey'],
        'appDataVersionId' => $resolved['versionLabel'],
        'appDataVersionLabel' => $resolved['versionLabel'],
        'appDataHash' => $resolved['snapshotHash'],
        'colors' => $normalized,
    ];
}

function resolveUsedColorIds(array $snapshot): ?array
{
    $rules = is_array($snapshot['stoneAvailabilityRules'] ?? null) ? $snapshot['stoneAvailabilityRules'] : [];
    $used = [];
    foreach ($rules as $rule) {
        if (!is_array($rule) || (($rule['enabled'] ?? true) === false)) {
            continue;
        }
        $stoneTypes = is_array($rule['stoneTypes'] ?? null) ? $rule['stoneTypes'] : [];
        if (!in_array('colored-stone', $stoneTypes, true)) {
            continue;
        }
        foreach ((is_array($rule['colors'] ?? null) ? $rule['colors'] : []) as $id) {
            if (is_string($id) && $id !== '') {
                $used[$id] = true;
            }
        }
    }
    return $used ? array_keys($used) : null;
}

function normalizeHexValue(mixed $value): string
{
    if (!is_string($value)) {
        throw new RuntimeException('Stone color entry has no hex value.');
    }
    $value = trim($value);
    if (preg_match('/^#?([0-9a-fA-F]{3})$/', $value, $match)) {
        return '#' . strtoupper($match[1][0] . $match[1][0] . $match[1][1] . $match[1][1] . $match[1][2] . $match[1][2]);
    }
    if (preg_match('/^#?([0-9a-fA-F]{6})$/', $value, $match)) {
        return '#' . strtoupper($match[1]);
    }
    throw new RuntimeException('Stone color entry contains an invalid hex value.');
}

function previewAsset(array $color): ?string
{
    foreach (['imageUrl', 'img'] as $field) {
        if (isset($color[$field]) && is_string($color[$field]) && trim($color[$field]) !== '') {
            return trim($color[$field]);
        }
    }
    return null;
}

function safeError(string $message): string
{
    return preg_replace('/(mysql:host=|pgsql:host=|sqlsrv:server=)[^;\s]+/i', '$1[redacted]', $message) ?? 'Operation failed.';
}
