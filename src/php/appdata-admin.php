<?php

declare(strict_types=1);

require __DIR__ . '/config.php';

$localConfig = __DIR__ . '/appdata-admin.config.local.php';
if (is_file($localConfig)) {
    include $localConfig;
}

const MAX_REQUEST_BYTES = 5242880;
const ADMIN_TABLE_BUILD = 'ringcfg_appdata_build';
const ADMIN_TABLE_VERSION = 'ringcfg_appdata_version';
const ADMIN_TABLE_COMPATIBILITY = 'ringcfg_appdata_build_compatibility';
const ADMIN_TABLE_TARGET = 'ringcfg_appdata_target';
const ADMIN_TABLE_RELEASE_HISTORY = 'ringcfg_appdata_release_history';
const ADMIN_TABLE_AUDIT = 'ringcfg_appdata_audit_log';

$requestId = bin2hex(random_bytes(16));

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fail(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported.');
    }

    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > MAX_REQUEST_BYTES) {
        fail(413, 'REQUEST_TOO_LARGE', 'Request body is too large.');
    }

    $input = readJsonBody();
    $action = requireAction($input);

    $handlers = [
        'bootstrap' => 'handleBootstrap',
        'listBuilds' => 'handleListBuilds',
        'registerBuild' => 'handleRegisterBuild',
        'listVersions' => 'handleListVersions',
        'getVersion' => 'handleGetVersion',
        'importCurrentBaseline' => 'handleImportCurrentBaseline',
        'saveVersion' => 'handleSaveVersion',
        'setCompatibility' => 'handleSetCompatibility',
        'approveVersion' => 'handleApproveVersion',
        'retireVersion' => 'handleRetireVersion',
        'listTargets' => 'handleListTargets',
        'assignTarget' => 'handleAssignTarget',
        'rollbackTarget' => 'handleRollbackTarget',
    ];

    if (!isset($handlers[$action])) {
        fail(400, 'UNKNOWN_ACTION', 'Action is not supported.');
    }

    $db = openAdminDatabase();
    $result = $handlers[$action]($db, $input, $requestId);
    respond(200, [
        'ok' => true,
        'requestId' => $requestId,
        'result' => $result,
    ]);
} catch (AdminHttpError $error) {
    respond($error->status, [
        'ok' => false,
        'requestId' => $requestId,
        'error' => [
            'code' => $error->codeName,
            'message' => $error->safeMessage,
        ],
    ]);
} catch (Throwable $error) {
    error_log('appdata-admin request failed: ' . get_class($error));
    respond(500, [
        'ok' => false,
        'requestId' => $requestId,
        'error' => [
            'code' => 'SERVER_ERROR',
            'message' => 'The AppData admin request failed.',
        ],
    ]);
}

final class AdminHttpError extends Exception
{
    public function __construct(
        public readonly int $status,
        public readonly string $codeName,
        public readonly string $safeMessage
    ) {
        parent::__construct($codeName);
    }
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $status, string $code, string $message): never
{
    throw new AdminHttpError($status, $code, $message);
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        fail(400, 'INVALID_JSON', 'Request body must contain JSON.');
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        fail(400, 'INVALID_JSON', 'Request body must be a JSON object.');
    }

    return $decoded;
}

function requireAction(array $input): string
{
    $action = $input['action'] ?? '';
    if (!is_string($action) || $action === '') {
        fail(400, 'INVALID_ACTION', 'Action is required.');
    }
    return $action;
}

function openAdminDatabase(): PDO
{
    if (!defined('DB_DSN') || DB_DSN === '') {
        fail(503, 'MISSING_CONFIGURATION', 'Database configuration is missing.');
    }

    return new PDO(DB_DSN, DB_USERNAME, DB_PASSWORD, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function envOrConstant(string $name, string $default = ''): string
{
    if (defined($name)) {
        $value = constant($name);
        return is_string($value) ? $value : $default;
    }

    $value = getenv($name);
    return $value === false ? $default : $value;
}

function permissionList(string $name): array
{
    return array_values(array_filter(array_map('trim', explode(',', envOrConstant($name)))));
}

function requireString(array $input, string $key): string
{
    $value = $input[$key] ?? '';
    if (!is_string($value) || trim($value) === '') {
        fail(400, 'VALIDATION_FAILED', $key . ' is required.');
    }
    return trim($value);
}

function requireArrayValue(array $input, string $key): array
{
    $value = $input[$key] ?? null;
    if (!is_array($value)) {
        fail(400, 'VALIDATION_FAILED', $key . ' must be an object.');
    }
    return $value;
}

function assertIdentifier(string $identifier): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        fail(500, 'SERVER_ERROR', 'Runtime table configuration is invalid.');
    }
    return $identifier;
}

function canonicalize(mixed $value): mixed
{
    if (!is_array($value)) {
        return $value;
    }

    if (array_is_list($value)) {
        return array_map('canonicalize', $value);
    }

    ksort($value);
    foreach ($value as $key => $child) {
        $value[$key] = canonicalize($child);
    }
    return $value;
}

function canonicalJson(mixed $value): string
{
    return json_encode(canonicalize($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function sha256OfJson(mixed $value): string
{
    return hash('sha256', canonicalJson($value));
}

function normalizeAppData(array $appData): array
{
    if ($appData === []) {
        fail(422, 'VALIDATION_FAILED', 'AppData must not be empty.');
    }
    validateAppData($appData);
    return canonicalize($appData);
}

function validateAppData(array $appData): void
{
    foreach (['profile', 'material', 'stoneType'] as $key) {
        if (!array_key_exists($key, $appData) || !is_array($appData[$key])) {
            fail(422, 'VALIDATION_FAILED', $key . ' must be present.');
        }
    }

    validateUniqueField($appData['material'], 'id', 'material.id');
    validateUniqueField($appData['stoneType'], 'id', 'stoneType.id');
    validateUniqueField($appData['profile'], 'name', 'profile.name');

    $materialIds = [];
    foreach ($appData['material'] as $material) {
        if (is_array($material) && isset($material['id'])) {
            $materialIds[(string)$material['id']] = true;
        }
    }

    if (isset($appData['materialExclude']) && is_array($appData['materialExclude'])) {
        foreach ($appData['materialExclude'] as $exclude) {
            if (!is_array($exclude)) {
                continue;
            }
            foreach (['mat1', 'mat2'] as $field) {
                if (isset($exclude[$field]) && !isset($materialIds[(string)$exclude[$field]])) {
                    fail(422, 'VALIDATION_FAILED', 'materialExclude contains an unknown material id.');
                }
            }
        }
    }

    validateRanges($appData);
}

function validateUniqueField(array $items, string $field, string $label): void
{
    $seen = [];
    foreach ($items as $item) {
        if (!is_array($item) || !array_key_exists($field, $item)) {
            continue;
        }
        $value = (string)$item[$field];
        if (isset($seen[$value])) {
            fail(422, 'VALIDATION_FAILED', 'Duplicate ' . $label . ' value.');
        }
        $seen[$value] = true;
    }
}

function validateRanges(mixed $value): void
{
    if (!is_array($value)) {
        return;
    }

    if (isset($value['min'], $value['max']) && is_numeric($value['min']) && is_numeric($value['max'])) {
        if ((float)$value['min'] > (float)$value['max']) {
            fail(422, 'VALIDATION_FAILED', 'A numeric range has min greater than max.');
        }
    }

    foreach ($value as $child) {
        validateRanges($child);
    }
}

function diffJson(mixed $before, mixed $after, string $path = ''): array
{
    if ($before === $after) {
        return [];
    }

    if (!is_array($before) || !is_array($after)) {
        return [[
            'path' => $path === '' ? '$' : $path,
            'before' => $before,
            'after' => $after,
        ]];
    }

    $changes = [];
    $keys = array_unique(array_merge(array_keys($before), array_keys($after)));
    foreach ($keys as $key) {
        $childPath = $path === '' ? (string)$key : $path . '.' . $key;
        if (!array_key_exists($key, $before)) {
            $changes[] = ['path' => $childPath, 'before' => null, 'after' => $after[$key]];
        } elseif (!array_key_exists($key, $after)) {
            $changes[] = ['path' => $childPath, 'before' => $before[$key], 'after' => null];
        } else {
            $changes = array_merge($changes, diffJson($before[$key], $after[$key], $childPath));
        }
    }

    return array_slice($changes, 0, 1000);
}

function semanticDiff(array $changes): array
{
    return array_map(static function (array $change): array {
        return [
            'path' => $change['path'],
            'summary' => summarizeChange($change),
        ];
    }, $changes);
}

function summarizeChange(array $change): string
{
    $before = $change['before'];
    $after = $change['after'];
    if ($before === null) {
        return 'added';
    }
    if ($after === null) {
        return 'removed';
    }
    return 'changed';
}

function decodeSnapshot(string $json): array
{
    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        fail(500, 'SERVER_ERROR', 'Stored AppData snapshot is invalid.');
    }
    return $decoded;
}

function verifyEmployee(array $input, array $requiredPermissions): array
{
    $username = requireString($input, 'username');
    $pin = requireString($input, 'pin');

    $url = envOrConstant('ONERINGCONF_USER_VERIFICATION_URL', 'https://toolbox.asf.gmbh/luna/user-verification.php');
    $key = envOrConstant('ONERINGCONF_USER_VERIFICATION_KEY');
    if ($key === '') {
        fail(503, 'MISSING_CONFIGURATION', 'User verification key is missing.');
    }

    $payload = json_encode([
        'username' => $username,
        'pin' => $pin,
        'requiredPermissions' => $requiredPermissions,
    ], JSON_UNESCAPED_SLASHES);

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => [
                'Content-Type: application/json',
                'X-Internal-Verification-Key: ' . $key,
            ],
            'content' => $payload,
            'ignore_errors' => true,
            'timeout' => 8,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        fail(502, 'SERVER_ERROR', 'User verification service is unavailable.');
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        fail(502, 'SERVER_ERROR', 'User verification service returned an invalid response.');
    }

    if (($decoded['verified'] ?? false) !== true) {
        $code = (string)($decoded['code'] ?? 'INVALID_CREDENTIALS');
        if ($code === 'RATE_LIMITED') {
            fail(429, 'RATE_LIMITED', 'Verification is temporarily rate limited.');
        }
        fail(401, 'INVALID_CREDENTIALS', 'Login or PIN is invalid.');
    }

    $permissions = $decoded['permissions'] ?? [];
    if (!is_array($permissions)) {
        $permissions = [];
    }

    foreach ($requiredPermissions as $permission) {
        if (!in_array($permission, $permissions, true)) {
            fail(403, 'FORBIDDEN', 'The verified user does not have the required permission.');
        }
    }

    return [
        'username' => $username,
        'displayName' => (string)($decoded['displayName'] ?? $username),
        'permissions' => $permissions,
    ];
}

function editorPermissions(): array
{
    return permissionList('ONERINGCONF_APPDATA_EDITOR_PERMISSIONS') ?: ['appdata:edit'];
}

function approverPermissions(): array
{
    return permissionList('ONERINGCONF_APPDATA_APPROVER_PERMISSIONS') ?: ['appdata:approve'];
}

function ensureBuild(PDO $db, array $build): int
{
    $buildKey = (string)($build['buildKey'] ?? '');
    if ($buildKey === '') {
        $buildKey = (string)($build['build_key'] ?? '');
    }
    $version = (string)($build['version'] ?? '');
    if ($version === '') {
        $version = (string)($build['version_label'] ?? '');
    }
    if ($buildKey === '' || $version === '') {
        fail(400, 'VALIDATION_FAILED', 'Build metadata is incomplete.');
    }

    $stmt = $db->prepare('select id from ' . ADMIN_TABLE_BUILD . ' where build_key = :build_key');
    $stmt->execute(['build_key' => $buildKey]);
    $row = $stmt->fetch();
    if ($row) {
        return (int)$row['id'];
    }

    $stmt = $db->prepare('
        insert into ' . ADMIN_TABLE_BUILD . '
            (build_key, app_version, git_commit, angular_version, babylon_version, created_by, notes)
        values
            (:build_key, :app_version, :git_commit, :angular_version, :babylon_version, :created_by, :notes)
    ');
    $stmt->execute([
        'build_key' => $buildKey,
        'app_version' => $version,
        'git_commit' => nullableString($build['gitCommit'] ?? null),
        'angular_version' => nullableString($build['angularVersion'] ?? null),
        'babylon_version' => nullableString($build['babylonVersion'] ?? null),
        'created_by' => nullableString($build['createdBy'] ?? 'development-admin'),
        'notes' => nullableString($build['notes'] ?? null),
    ]);

    return (int)$db->lastInsertId();
}

function nullableString(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $trimmed = trim($value);
    return $trimmed === '' ? null : $trimmed;
}

function audit(PDO $db, string $requestId, string $action, ?int $buildId, ?int $versionId, ?string $targetKey, array $actor, array $metadata = []): void
{
    $stmt = $db->prepare('
        insert into ' . ADMIN_TABLE_AUDIT . '
            (request_id, action, actor_username, actor_display_name, build_id, appdata_version_id, target_key, metadata_json, ip_address, user_agent)
        values
            (:request_id, :action, :actor_username, :actor_display_name, :build_id, :appdata_version_id, :target_key, cast(:metadata_json as json), :ip_address, :user_agent)
    ');
    $stmt->execute([
        'request_id' => $requestId,
        'action' => $action,
        'actor_username' => (string)($actor['username'] ?? 'system'),
        'actor_display_name' => nullableString($actor['displayName'] ?? null),
        'build_id' => $buildId,
        'appdata_version_id' => $versionId,
        'target_key' => $targetKey,
        'metadata_json' => json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 512),
    ]);
}

function handleBootstrap(PDO $db, array $input, string $requestId): array
{
    $targets = fetchTargets($db);
    $versions = fetchVersions($db);
    $builds = fetchBuilds($db);
    $compatibilities = fetchCompatibilities($db);
    $active = fetchActiveTarget($db, (string)($input['targetKey'] ?? 'local-development'));
    $legacy = null;
    $appData = null;
    $activeHash = null;
    $activeVersion = null;

    if ($active === null) {
        $legacy = fetchLegacyAppData($db);
        $appData = $legacy;
        $activeHash = $legacy === null ? null : sha256OfJson($legacy);
    } else {
        $appData = $active['snapshot'];
        $activeHash = $active['hash'];
        $activeVersion = [
            'id' => $active['versionId'],
            'version_label' => $active['versionLabel'],
            'state' => 'active',
            'snapshot_hash' => $active['hash'],
            'build_key' => $active['buildKey'],
        ];
    }

    return [
        'build' => $input['build'] ?? null,
        'activeVersion' => $activeVersion,
        'appData' => $appData,
        'activeAppData' => $appData,
        'activeHash' => $activeHash,
        'builds' => $builds,
        'versions' => $versions,
        'compatibilities' => $compatibilities,
        'targets' => $targets,
        'permissions' => [
            'editor' => editorPermissions(),
            'approver' => approverPermissions(),
        ],
        'canImportBaseline' => count($versions) === 0 && $legacy !== null,
    ];
}

function handleListBuilds(PDO $db): array
{
    return ['builds' => fetchBuilds($db)];
}

function handleRegisterBuild(PDO $db, array $input, string $requestId): array
{
    $actor = verifyEmployee($input, editorPermissions());
    $db->beginTransaction();
    $buildId = ensureBuild($db, requireArrayValue($input, 'build'));
    audit($db, $requestId, 'registerBuild', $buildId, null, null, $actor);
    $db->commit();
    return ['buildId' => $buildId];
}

function handleListVersions(PDO $db): array
{
    return ['versions' => fetchVersions($db)];
}

function handleGetVersion(PDO $db, array $input): array
{
    $version = fetchVersion($db, (int)($input['versionId'] ?? 0), true);
    $snapshot = $version['snapshot'];
    unset($version['snapshot']);
    return [
        'version' => $version,
        'appData' => $snapshot,
        'hash' => $version['snapshot_hash'],
    ];
}

function handleImportCurrentBaseline(PDO $db, array $input, string $requestId): array
{
    $actor = verifyEmployee($input, editorPermissions());
    $changeReason = requireString($input, 'changeReason');
    $label = nullableString($input['versionLabel'] ?? null)
        ?? nullableString($input['baselineVersionLabel'] ?? null)
        ?? '3.0.216.4';
    $parts = parseVersionLabel($label);
    $legacy = fetchLegacyAppData($db);
    if ($legacy === null) {
        fail(404, 'NOT_FOUND', 'No legacy TABLE_DATA appdata entry exists.');
    }

    $snapshot = normalizeAppData($legacy);
    $hash = sha256OfJson($snapshot);
    $db->beginTransaction();
    if (countVersionsForUpdate($db) > 0) {
        $db->rollBack();
        fail(409, 'CONFLICT', 'An AppData baseline already exists.');
    }
    $buildId = ensureBuild($db, requireArrayValue($input, 'build'));
    $versionId = insertVersion($db, $buildId, $parts, $snapshot, $hash, $changeReason, $actor, 'draft', null, [], []);
    upsertCompatibility($db, $buildId, $versionId, 'untested', $actor, 'Baseline import requires testing.');
    audit($db, $requestId, 'importCurrentBaseline', $buildId, $versionId, null, $actor, ['hash' => $hash]);
    $db->commit();

    return ['versionId' => $versionId, 'hash' => $hash, 'versionLabel' => formatVersion($parts)];
}

function handleSaveVersion(PDO $db, array $input, string $requestId): array
{
    $actor = verifyEmployee($input, editorPermissions());
    $changeReason = requireString($input, 'changeReason');
    $baseVersionId = (int)($input['baseVersionId'] ?? 0);
    $baseHash = requireString($input, 'baseHash');
    $bump = (string)($input['bump'] ?? 'revision');
    $appData = requireArrayValue($input, 'appData');

    $db->beginTransaction();
    $base = fetchVersionForUpdate($db, $baseVersionId);
    if ($base['snapshot_hash'] !== $baseHash) {
        $db->rollBack();
        fail(409, 'CONFLICT', 'The AppData base version changed before saving.');
    }

    $snapshot = normalizeAppData($appData);
    $hash = sha256OfJson($snapshot);
    if ($hash === $baseHash || versionHashExists($db, $hash)) {
        $db->rollBack();
        fail(409, 'IDENTICAL_SNAPSHOT', 'The AppData snapshot is unchanged or already stored.');
    }

    $baseSnapshot = decodeSnapshot($base['snapshot_json']);
    $diff = diffJson($baseSnapshot, $snapshot);
    $semanticDiff = semanticDiff($diff);
    $parts = nextVersionParts($base, $bump);
    $buildId = ensureBuild($db, requireArrayValue($input, 'build'));
    $versionId = insertVersion($db, $buildId, $parts, $snapshot, $hash, $changeReason, $actor, 'draft', $baseVersionId, $diff, $semanticDiff);
    upsertCompatibility($db, $buildId, $versionId, 'untested', $actor, 'New AppData version requires testing.');
    audit($db, $requestId, 'saveVersion', $buildId, $versionId, null, $actor, [
        'baseVersionId' => $baseVersionId,
        'changeCount' => count($diff),
        'hash' => $hash,
    ]);
    $db->commit();

    return [
        'versionId' => $versionId,
        'versionLabel' => formatVersion($parts),
        'hash' => $hash,
        'changeCount' => count($diff),
    ];
}

function handleSetCompatibility(PDO $db, array $input, string $requestId): array
{
    $actor = verifyEmployee($input, editorPermissions());
    $status = (string)($input['status'] ?? '');
    if (!in_array($status, ['compatible', 'incompatible'], true)) {
        fail(400, 'VALIDATION_FAILED', 'Compatibility status is invalid.');
    }
    $note = requireString($input, 'note');
    $versionId = (int)($input['versionId'] ?? 0);

    $db->beginTransaction();
    fetchVersionForUpdate($db, $versionId);
    $buildId = ensureBuild($db, requireArrayValue($input, 'build'));
    upsertCompatibility($db, $buildId, $versionId, $status, $actor, $note);
    audit($db, $requestId, 'setCompatibility', $buildId, $versionId, null, $actor, ['status' => $status]);
    $db->commit();
    return ['status' => $status];
}

function handleApproveVersion(PDO $db, array $input, string $requestId): array
{
    $actor = verifyEmployee($input, approverPermissions());
    $versionId = (int)($input['versionId'] ?? 0);
    $reason = requireString($input, 'changeReason');

    $db->beginTransaction();
    $version = fetchVersionForUpdate($db, $versionId);
    if ($version['state'] === 'retired') {
        $db->rollBack();
        fail(409, 'CONFLICT', 'Retired AppData versions cannot be approved.');
    }
    if (!hasCompatibleBuild($db, $versionId)) {
        $db->rollBack();
        fail(409, 'CONFLICT', 'At least one compatible build is required before approval.');
    }

    $stmt = $db->prepare('
        update ' . ADMIN_TABLE_VERSION . '
        set state = "approved", approved_at = current_timestamp(6), approved_by = :approved_by, approval_reason = :approval_reason
        where id = :id
    ');
    $stmt->execute([
        'id' => $versionId,
        'approved_by' => $actor['username'],
        'approval_reason' => $reason,
    ]);
    audit($db, $requestId, 'approveVersion', null, $versionId, null, $actor, ['reason' => $reason]);
    $db->commit();

    return ['state' => 'approved'];
}

function handleRetireVersion(PDO $db, array $input, string $requestId): array
{
    $actor = verifyEmployee($input, approverPermissions());
    $versionId = (int)($input['versionId'] ?? 0);
    $reason = requireString($input, 'changeReason');

    $db->beginTransaction();
    fetchVersionForUpdate($db, $versionId);
    $stmt = $db->prepare('update ' . ADMIN_TABLE_VERSION . ' set state = "retired" where id = :id');
    $stmt->execute(['id' => $versionId]);
    audit($db, $requestId, 'retireVersion', null, $versionId, null, $actor, ['reason' => $reason]);
    $db->commit();

    return ['state' => 'retired'];
}

function handleListTargets(PDO $db): array
{
    return ['targets' => fetchTargets($db)];
}

function handleAssignTarget(PDO $db, array $input, string $requestId): array
{
    return assignTarget($db, $input, $requestId, 'assign');
}

function handleRollbackTarget(PDO $db, array $input, string $requestId): array
{
    return assignTarget($db, $input, $requestId, 'rollback');
}

function assignTarget(PDO $db, array $input, string $requestId, string $action): array
{
    $actor = verifyEmployee($input, approverPermissions());
    $targetKey = requireString($input, 'targetKey');
    $versionId = (int)($input['versionId'] ?? 0);
    $reason = requireString($input, 'changeReason');

    $db->beginTransaction();
    $target = fetchTargetForUpdate($db, $targetKey);
    $version = fetchVersionForUpdate($db, $versionId);
    $buildId = ensureBuild($db, requireArrayValue($input, 'build'));
    $compatibility = fetchCompatibility($db, $buildId, $versionId);

    if (($target['environment'] ?? '') === 'production') {
        if ($version['state'] !== 'approved') {
            $db->rollBack();
            fail(409, 'CONFLICT', 'Production targets require an approved AppData version.');
        }
        if (($compatibility['status'] ?? '') !== 'compatible') {
            $db->rollBack();
            fail(409, 'CONFLICT', 'Production targets require an exactly compatible build/AppData pair.');
        }
    }

    $previousBuildId = $target['active_build_id'] === null ? null : (int)$target['active_build_id'];
    $previousVersionId = $target['active_appdata_version_id'] === null ? null : (int)$target['active_appdata_version_id'];

    $stmt = $db->prepare('
        update ' . ADMIN_TABLE_TARGET . '
        set active_build_id = :build_id,
            active_appdata_version_id = :version_id,
            updated_at = current_timestamp(6)
        where target_key = :target_key
    ');
    $stmt->execute([
        'build_id' => $buildId,
        'version_id' => $versionId,
        'target_key' => $targetKey,
    ]);

    $stmt = $db->prepare('
        insert into ' . ADMIN_TABLE_RELEASE_HISTORY . '
            (target_key, previous_build_id, previous_appdata_version_id, new_build_id, new_appdata_version_id, action, reason, assigned_by)
        values
            (:target_key, :previous_build_id, :previous_version_id, :new_build_id, :new_version_id, :action, :reason, :assigned_by)
    ');
    $stmt->execute([
        'target_key' => $targetKey,
        'previous_build_id' => $previousBuildId,
        'previous_version_id' => $previousVersionId,
        'new_build_id' => $buildId,
        'new_version_id' => $versionId,
        'action' => $action,
        'reason' => $reason,
        'assigned_by' => $actor['username'],
    ]);

    if ($targetKey === 'local-development') {
        mirrorRuntimeAppData($db, decodeSnapshot($version['snapshot_json']));
    }

    audit($db, $requestId, $action === 'rollback' ? 'rollbackTarget' : 'assignTarget', $buildId, $versionId, $targetKey, $actor, ['reason' => $reason]);
    $db->commit();

    return ['targetKey' => $targetKey, 'buildId' => $buildId, 'versionId' => $versionId];
}

function fetchBuilds(PDO $db): array
{
    return $db->query('select * from ' . ADMIN_TABLE_BUILD . ' order by created_at desc, id desc')->fetchAll();
}

function fetchVersions(PDO $db): array
{
    return $db->query('
        select id, version_label, major, minor, patch, revision, snapshot_hash, state, created_at, created_by, approved_at, approved_by, created_for_build_id
        from ' . ADMIN_TABLE_VERSION . '
        order by major desc, minor desc, patch desc, revision desc, id desc
    ')->fetchAll();
}

function fetchCompatibilities(PDO $db): array
{
    return $db->query('select * from ' . ADMIN_TABLE_COMPATIBILITY . ' order by tested_at desc, id desc')->fetchAll();
}

function fetchTargets(PDO $db): array
{
    return $db->query('select * from ' . ADMIN_TABLE_TARGET . ' order by target_key asc')->fetchAll();
}

function fetchActiveTarget(PDO $db, string $targetKey): ?array
{
    $stmt = $db->prepare('
        select t.*, v.version_label, v.snapshot_hash, v.snapshot_json, b.build_key
        from ' . ADMIN_TABLE_TARGET . ' t
        left join ' . ADMIN_TABLE_VERSION . ' v on v.id = t.active_appdata_version_id
        left join ' . ADMIN_TABLE_BUILD . ' b on b.id = t.active_build_id
        where t.target_key = :target_key and t.is_active = 1
    ');
    $stmt->execute(['target_key' => $targetKey]);
    $row = $stmt->fetch();
    if (!$row || $row['snapshot_json'] === null) {
        return null;
    }

    return [
        'targetKey' => $row['target_key'],
        'buildKey' => $row['build_key'],
        'versionId' => (int)$row['active_appdata_version_id'],
        'versionLabel' => $row['version_label'],
        'hash' => $row['snapshot_hash'],
        'snapshot' => decodeSnapshot($row['snapshot_json']),
    ];
}

function fetchVersion(PDO $db, int $versionId, bool $includeSnapshot): array
{
    $stmt = $db->prepare('select * from ' . ADMIN_TABLE_VERSION . ' where id = :id');
    $stmt->execute(['id' => $versionId]);
    $row = $stmt->fetch();
    if (!$row) {
        fail(404, 'NOT_FOUND', 'AppData version was not found.');
    }
    if ($includeSnapshot) {
        $row['snapshot'] = decodeSnapshot($row['snapshot_json']);
    }
    unset($row['snapshot_json']);
    return $row;
}

function fetchVersionForUpdate(PDO $db, int $versionId): array
{
    $stmt = $db->prepare('select * from ' . ADMIN_TABLE_VERSION . ' where id = :id for update');
    $stmt->execute(['id' => $versionId]);
    $row = $stmt->fetch();
    if (!$row) {
        fail(404, 'NOT_FOUND', 'AppData version was not found.');
    }
    return $row;
}

function fetchTargetForUpdate(PDO $db, string $targetKey): array
{
    $stmt = $db->prepare('select * from ' . ADMIN_TABLE_TARGET . ' where target_key = :target_key and is_active = 1 for update');
    $stmt->execute(['target_key' => $targetKey]);
    $row = $stmt->fetch();
    if (!$row) {
        fail(404, 'NOT_FOUND', 'Target was not found.');
    }
    return $row;
}

function fetchCompatibility(PDO $db, int $buildId, int $versionId): ?array
{
    $stmt = $db->prepare('
        select * from ' . ADMIN_TABLE_COMPATIBILITY . '
        where build_id = :build_id and appdata_version_id = :version_id
    ');
    $stmt->execute(['build_id' => $buildId, 'version_id' => $versionId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function hasCompatibleBuild(PDO $db, int $versionId): bool
{
    $stmt = $db->prepare('
        select id from ' . ADMIN_TABLE_COMPATIBILITY . '
        where appdata_version_id = :version_id and status = "compatible"
        limit 1
    ');
    $stmt->execute(['version_id' => $versionId]);
    return (bool)$stmt->fetch();
}

function countVersionsForUpdate(PDO $db): int
{
    $row = $db->query('select count(*) as count from ' . ADMIN_TABLE_VERSION . ' for update')->fetch();
    return (int)$row['count'];
}

function versionHashExists(PDO $db, string $hash): bool
{
    $stmt = $db->prepare('select id from ' . ADMIN_TABLE_VERSION . ' where snapshot_hash = :hash limit 1');
    $stmt->execute(['hash' => $hash]);
    return (bool)$stmt->fetch();
}

function insertVersion(PDO $db, int $buildId, array $parts, array $snapshot, string $hash, string $reason, array $actor, string $state, ?int $baseVersionId, array $diff, array $semanticDiff): int
{
    $stmt = $db->prepare('
        insert into ' . ADMIN_TABLE_VERSION . '
            (version_label, major, minor, patch, revision, snapshot_json, snapshot_hash, state, created_by, change_reason, base_version_id, created_for_build_id, diff_json, semantic_diff_json)
        values
            (:version_label, :major, :minor, :patch, :revision, cast(:snapshot_json as json), :snapshot_hash, :state, :created_by, :change_reason, :base_version_id, :created_for_build_id, cast(:diff_json as json), cast(:semantic_diff_json as json))
    ');
    $stmt->execute([
        'version_label' => formatVersion($parts),
        'major' => $parts['major'],
        'minor' => $parts['minor'],
        'patch' => $parts['patch'],
        'revision' => $parts['revision'],
        'snapshot_json' => canonicalJson($snapshot),
        'snapshot_hash' => $hash,
        'state' => $state,
        'created_by' => $actor['username'] ?? 'system',
        'change_reason' => $reason,
        'base_version_id' => $baseVersionId,
        'created_for_build_id' => $buildId,
        'diff_json' => json_encode($diff, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        'semantic_diff_json' => json_encode($semanticDiff, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);
    return (int)$db->lastInsertId();
}

function upsertCompatibility(PDO $db, int $buildId, int $versionId, string $status, array $actor, string $note): void
{
    $stmt = $db->prepare('
        insert into ' . ADMIN_TABLE_COMPATIBILITY . '
            (build_id, appdata_version_id, status, tested_by, test_note)
        values
            (:build_id, :version_id, :status, :tested_by, :test_note)
        on duplicate key update
            status = values(status),
            tested_at = current_timestamp(6),
            tested_by = values(tested_by),
            test_note = values(test_note)
    ');
    $stmt->execute([
        'build_id' => $buildId,
        'version_id' => $versionId,
        'status' => $status,
        'tested_by' => $actor['username'] ?? 'system',
        'test_note' => $note,
    ]);
}

function fetchLegacyAppData(PDO $db): ?array
{
    $table = assertIdentifier(TABLE_DATA);
    $stmt = $db->prepare('select value from ' . $table . ' where id = :id limit 1');
    $stmt->execute(['id' => 'appdata']);
    $row = $stmt->fetch();
    if (!$row || !is_string($row['value'])) {
        return null;
    }
    $decoded = json_decode($row['value'], true);
    return is_array($decoded) ? $decoded : null;
}

function mirrorRuntimeAppData(PDO $db, array $snapshot): void
{
    $table = assertIdentifier(TABLE_DATA);
    $stmt = $db->prepare('
        insert into ' . $table . ' (id, value)
        values (:id, :value)
        on duplicate key update value = values(value)
    ');
    $stmt->execute(['id' => 'appdata', 'value' => canonicalJson($snapshot)]);
}

function parseVersionLabel(string $label): array
{
    if (!preg_match('/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/', $label, $matches)) {
        fail(422, 'VALIDATION_FAILED', 'Version label must use major.minor.patch.revision.');
    }
    return [
        'major' => (int)$matches[1],
        'minor' => (int)$matches[2],
        'patch' => (int)$matches[3],
        'revision' => (int)$matches[4],
    ];
}

function nextVersionParts(array $base, string $bump): array
{
    $parts = [
        'major' => (int)$base['major'],
        'minor' => (int)$base['minor'],
        'patch' => (int)$base['patch'],
        'revision' => (int)$base['revision'],
    ];

    if ($bump === 'major') {
        $parts['major']++;
        $parts['minor'] = 0;
        $parts['patch'] = 0;
        $parts['revision'] = 0;
    } elseif ($bump === 'minor') {
        $parts['minor']++;
        $parts['patch'] = 0;
        $parts['revision'] = 0;
    } elseif ($bump === 'patch') {
        $parts['patch']++;
        $parts['revision'] = 0;
    } else {
        $parts['revision']++;
    }

    return $parts;
}

function formatVersion(array $parts): string
{
    return $parts['major'] . '.' . $parts['minor'] . '.' . $parts['patch'] . '.' . $parts['revision'];
}
