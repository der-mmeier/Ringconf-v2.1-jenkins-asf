<?php

declare(strict_types=1);

if (!defined('RINGCONF_ADMIN_COMMON_ONLY')) {
  define('RINGCONF_ADMIN_COMMON_ONLY', true);
}

require_once __DIR__ . '/appdata-admin.php';

const CALIBRATION_JSON_LIMIT = 1048576;

if (calibrationAdminIsDirectRequest()) {
  runCalibrationAdminEndpoint();
}

function calibrationAdminIsDirectRequest(): bool
{
  $script = isset($_SERVER['SCRIPT_FILENAME']) ? realpath((string)$_SERVER['SCRIPT_FILENAME']) : false;
  $self = realpath(__FILE__);
  return $script !== false && $self !== false && $script === $self;
}

function runCalibrationAdminEndpoint(): never
{
  ob_start();
  $requestId = bin2hex(random_bytes(16));
  $input = [];
  $action = 'unknown';
  $db = null;

  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');

  try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
      fail(405, 'METHOD_NOT_ALLOWED', 'Only POST is supported.');
    }

    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > MAX_REQUEST_BYTES) {
      fail(413, 'REQUEST_TOO_LARGE', 'Request body is too large.');
    }

    $input = readJsonBody();
    $action = requireAction($input);
    if ($action === 'calibrationAuthenticate') {
      $result = handleCalibrationAuthenticate($input);
      respond(200, [
        'ok' => true,
        'requestId' => $requestId,
        'result' => $result,
      ]);
    }

    $handlers = [
      'calibrationBootstrap' => 'handleCalibrationBootstrap',
      'calibrationUpdateComposition' => 'handleCalibrationUpdateComposition',
      'calibrationCreateView' => 'handleCalibrationCreateView',
      'calibrationUpdateView' => 'handleCalibrationUpdateView',
      'calibrationDuplicateView' => 'handleCalibrationDuplicateView',
      'calibrationDeleteView' => 'handleCalibrationDeleteView',
      'calibrationSortViews' => 'handleCalibrationSortViews',
      'calibrationSetDefaultView' => 'handleCalibrationSetDefaultView',
      'calibrationSetViewEnabled' => 'handleCalibrationSetViewEnabled',
      'calibrationActivateProfile' => 'handleCalibrationActivateProfile',
    ];

    $handler = $handlers[$action] ?? null;
    if (!is_string($handler) || !is_callable($handler)) {
      fail(400, 'UNKNOWN_ACTION', 'Action is not supported by the calibration admin endpoint.');
    }

    $db = openAdminDatabase();
    $result = $handler($db, $input, $requestId);
    respond(200, [
      'ok' => true,
      'requestId' => $requestId,
      'result' => $result,
    ]);
  } catch (AdminHttpError $error) {
    rollbackCalibrationTransaction($db);
    respond($error->status, [
      'ok' => false,
      'requestId' => $requestId,
      'error' => [
        'code' => $error->codeName,
        'message' => $error->safeMessage,
      ],
    ]);
  } catch (Throwable $error) {
    rollbackCalibrationTransaction($db);
    error_log(sprintf(
      'calibration-admin request failed [%s] action=%s: %s: %s in %s:%d',
      $requestId,
      $action,
      get_class($error),
      $error->getMessage(),
      $error->getFile(),
      $error->getLine()
    ));
    respond(500, [
      'ok' => false,
      'requestId' => $requestId,
      'error' => [
        'code' => 'CALIBRATION_ADMIN_REQUEST_FAILED',
        'message' => 'The calibration admin request failed. Reference requestId ' . $requestId . '.',
      ],
    ]);
  }
}

function rollbackCalibrationTransaction(?PDO $db): void
{
  if ($db instanceof PDO && $db->inTransaction()) {
    $db->rollBack();
  }
}

function calibrationTable(string $kind): string
{
  $map = [
    'profile' => TABLE_CALIBRATION_PROFILE,
    'composition' => TABLE_CALIBRATION_COMPOSITION,
    'view' => TABLE_CALIBRATION_VIEW,
  ];
  return assertIdentifier($map[$kind] ?? '');
}

function handleCalibrationAuthenticate(array $input): array
{
  $actor = verifyEmployee($input, editorPermissions());

  return [
    'authenticated' => true,
    'username' => actorUsername($actor),
    'permissions' => array_values(array_filter(array_map(
      'strval',
      $actor['permissions'] ?? []
    ))),
    'authenticatedAt' => gmdate('c'),
  ];
}

function handleCalibrationBootstrap(PDO $db, array $input, string $requestId): array
{
  verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  return calibrationBootstrapPayload($db);
}

function calibrationBootstrapPayload(PDO $db): array
{
  $profile = fetchActiveCalibrationProfileRow($db);
  return [
    'profile' => $profile ? hydrateCalibrationProfileForAdmin($db, $profile, true) : null,
  ];
}

function handleCalibrationUpdateComposition(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  $compositionId = positiveId($input['compositionId'] ?? 0, 'compositionId');
  $expectedRevision = positiveId($input['revision'] ?? 0, 'revision');
  $payload = requireArrayValue($input, 'composition');

  $db->beginTransaction();
  $row = fetchCompositionForUpdate($db, $compositionId);
  requireRevision((int)$row['revision'], $expectedRevision);
  $stmt = $db->prepare('
    update ' . calibrationTable('composition') . '
    set label = :label,
        active_slots_json = :active_slots_json,
        startup_sequence_json = :startup_sequence_json,
        natural_ring_layout_json = :natural_ring_layout_json,
        default_framing_json = :default_framing_json,
        enabled = :enabled,
        sort_order = :sort_order,
        revision = revision + 1
    where id = :id
  ');
  $stmt->execute([
    'id' => $compositionId,
    'label' => cleanCalibrationName($payload['label'] ?? $row['label']),
    'active_slots_json' => encodeCalibrationJson($payload['activeSlots'] ?? decodeCalibrationJson((string)$row['active_slots_json'], 'active_slots_json')),
    'startup_sequence_json' => encodeCalibrationJson($payload['startupSequence'] ?? decodeCalibrationJson((string)$row['startup_sequence_json'], 'startup_sequence_json')),
    'natural_ring_layout_json' => encodeCalibrationJson($payload['naturalRingLayout'] ?? decodeCalibrationJson((string)$row['natural_ring_layout_json'], 'natural_ring_layout_json')),
    'default_framing_json' => encodeCalibrationJson($payload['defaultFraming'] ?? decodeCalibrationJson((string)$row['default_framing_json'], 'default_framing_json')),
    'enabled' => calibrationBooleanValue($payload, 'enabled', (bool)$row['enabled']),
    'sort_order' => (int)($payload['sortOrder'] ?? $row['sort_order']),
  ]);
  audit($db, $requestId, 'calibrationUpdateComposition', null, null, null, $actor, ['compositionId' => $compositionId]);
  $db->commit();

  return calibrationBootstrapPayload($db);
}

function handleCalibrationCreateView(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  $compositionId = positiveId($input['compositionId'] ?? 0, 'compositionId');
  $view = requireArrayValue($input, 'view');
  $viewKey = cleanCalibrationKey((string)($view['viewKey'] ?? ''));
  $name = cleanCalibrationName($view['name'] ?? '');
  if ($viewKey === '' || $name === '') {
    fail(422, 'VALIDATION_FAILED', 'View key and name are required.');
  }

  $db->beginTransaction();
  fetchCompositionForUpdate($db, $compositionId);
  $stmt = $db->prepare('
    insert into ' . calibrationTable('view') . '
      (composition_id, view_key, name, enabled, is_default, sort_order, camera_json, ring_layout_json, framing_json, revision, created_by, updated_by)
    values
      (:composition_id, :view_key, :name, :enabled, :is_default, :sort_order, :camera_json, :ring_layout_json, :framing_json, 1, :created_by, :updated_by)
  ');
  $stmt->execute(viewSqlPayload($compositionId, $view, $actor, $viewKey, $name));
  $newViewId = (int)$db->lastInsertId();
  if (($view['isDefault'] ?? false) === true) {
    setDefaultView($db, $compositionId, $newViewId);
  } else {
    ensureDefaultViewForComposition($db, $compositionId);
  }
  audit($db, $requestId, 'calibrationCreateView', null, null, null, $actor, ['compositionId' => $compositionId, 'viewKey' => $viewKey]);
  $db->commit();

  return calibrationBootstrapPayload($db);
}

function handleCalibrationUpdateView(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  $viewId = positiveId($input['viewId'] ?? 0, 'viewId');
  $expectedRevision = positiveId($input['revision'] ?? 0, 'revision');
  $view = requireArrayValue($input, 'view');

  $db->beginTransaction();
  $row = fetchViewForUpdate($db, $viewId);
  requireRevision((int)$row['revision'], $expectedRevision);

  $enabled = calibrationBooleanValue($view, 'enabled', (bool)$row['enabled']);
  $isDefault = calibrationBooleanValue($view, 'isDefault', (bool)$row['is_default']);
  if ($enabled === 0) {
    $isDefault = 0;
  }

  $stmt = $db->prepare('
    update ' . calibrationTable('view') . '
    set name = :name,
        enabled = :enabled,
        is_default = :is_default,
        sort_order = :sort_order,
        camera_json = :camera_json,
        ring_layout_json = :ring_layout_json,
        framing_json = :framing_json,
        revision = revision + 1,
        updated_by = :updated_by
    where id = :id
  ');
  $stmt->execute([
    'id' => $viewId,
    'name' => cleanCalibrationName($view['name'] ?? $row['name']),
    'enabled' => $enabled,
    'is_default' => $isDefault,
    'sort_order' => (int)($view['sortOrder'] ?? $row['sort_order']),
    'camera_json' => encodeCalibrationJson($view['camera'] ?? decodeCalibrationJson((string)$row['camera_json'], 'camera_json')),
    'ring_layout_json' => encodeCalibrationJson($view['ringLayout'] ?? decodeCalibrationJson((string)$row['ring_layout_json'], 'ring_layout_json')),
    'framing_json' => encodeCalibrationJson($view['framing'] ?? decodeCalibrationJson((string)$row['framing_json'], 'framing_json')),
    'updated_by' => actorUsername($actor),
  ]);

  if ($isDefault === 1) {
    setDefaultView($db, (int)$row['composition_id'], $viewId);
  } elseif ((bool)$row['is_default']) {
    ensureDefaultViewForComposition($db, (int)$row['composition_id'], $viewId);
  }

  audit($db, $requestId, 'calibrationUpdateView', null, null, null, $actor, ['viewId' => $viewId]);
  $db->commit();

  return calibrationBootstrapPayload($db);
}

function handleCalibrationDuplicateView(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  $viewId = positiveId($input['viewId'] ?? 0, 'viewId');
  $newKey = cleanCalibrationKey((string)($input['viewKey'] ?? ''));
  $newName = cleanCalibrationName($input['name'] ?? '');
  if ($newKey === '' || $newName === '') {
    fail(422, 'VALIDATION_FAILED', 'Duplicate view key and name are required.');
  }

  $db->beginTransaction();
  $row = fetchViewForUpdate($db, $viewId);
  $stmt = $db->prepare('
    insert into ' . calibrationTable('view') . '
      (composition_id, view_key, name, enabled, is_default, sort_order, camera_json, ring_layout_json, framing_json, revision, created_by, updated_by)
    values
      (:composition_id, :view_key, :name, :enabled, 0, :sort_order, :camera_json, :ring_layout_json, :framing_json, 1, :created_by, :updated_by)
  ');
  $stmt->execute([
    'composition_id' => (int)$row['composition_id'],
    'view_key' => $newKey,
    'name' => $newName,
    'enabled' => (int)$row['enabled'],
    'sort_order' => (int)$row['sort_order'] + 1,
    'camera_json' => $row['camera_json'],
    'ring_layout_json' => $row['ring_layout_json'],
    'framing_json' => $row['framing_json'],
    'created_by' => actorUsername($actor),
    'updated_by' => actorUsername($actor),
  ]);
  audit($db, $requestId, 'calibrationDuplicateView', null, null, null, $actor, ['viewId' => $viewId, 'newKey' => $newKey]);
  $db->commit();

  return calibrationBootstrapPayload($db);
}

function handleCalibrationDeleteView(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  $viewId = positiveId($input['viewId'] ?? 0, 'viewId');
  $revision = positiveId($input['revision'] ?? 0, 'revision');

  $db->beginTransaction();
  $row = fetchViewForUpdate($db, $viewId);
  requireRevision((int)$row['revision'], $revision);
  $stmt = $db->prepare('delete from ' . calibrationTable('view') . ' where id = :id');
  $stmt->execute(['id' => $viewId]);
  if ((bool)$row['is_default']) {
    ensureDefaultViewForComposition($db, (int)$row['composition_id']);
  }
  audit($db, $requestId, 'calibrationDeleteView', null, null, null, $actor, ['viewId' => $viewId]);
  $db->commit();

  return calibrationBootstrapPayload($db);
}

function handleCalibrationSortViews(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  $compositionId = positiveId($input['compositionId'] ?? 0, 'compositionId');
  $ids = $input['viewIds'] ?? [];
  if (!is_array($ids)) {
    fail(422, 'VALIDATION_FAILED', 'viewIds must be an array.');
  }
  $db->beginTransaction();
  fetchCompositionForUpdate($db, $compositionId);
  $normalizedIds = [];
  foreach (array_values($ids) as $id) {
    $normalizedId = positiveId($id, 'viewIds');
    if (isset($normalizedIds[$normalizedId])) {
      fail(422, 'VALIDATION_FAILED', 'viewIds must not contain duplicates.');
    }
    $normalizedIds[$normalizedId] = true;
  }

  $stmt = $db->prepare('update ' . calibrationTable('view') . ' set sort_order = :sort_order, revision = revision + 1, updated_by = :updated_by where id = :id and composition_id = :composition_id');
  foreach (array_keys($normalizedIds) as $index => $id) {
    $stmt->execute([
      'id' => $id,
      'composition_id' => $compositionId,
      'sort_order' => $index * 10,
      'updated_by' => actorUsername($actor),
    ]);
    if ($stmt->rowCount() !== 1) {
      fail(422, 'VALIDATION_FAILED', 'A view does not belong to the selected composition.');
    }
  }
  audit($db, $requestId, 'calibrationSortViews', null, null, null, $actor, ['compositionId' => $compositionId]);
  $db->commit();
  return calibrationBootstrapPayload($db);
}

function handleCalibrationSetDefaultView(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  $viewId = positiveId($input['viewId'] ?? 0, 'viewId');
  $db->beginTransaction();
  $row = fetchViewForUpdate($db, $viewId);
  setDefaultView($db, (int)$row['composition_id'], $viewId);
  audit($db, $requestId, 'calibrationSetDefaultView', null, null, null, $actor, ['viewId' => $viewId]);
  $db->commit();
  return calibrationBootstrapPayload($db);
}

function handleCalibrationSetViewEnabled(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, editorPermissions());
  ensureCalibrationStorage($db);
  $viewId = positiveId($input['viewId'] ?? 0, 'viewId');
  $revision = positiveId($input['revision'] ?? 0, 'revision');
  if (!array_key_exists('enabled', $input) || !is_bool($input['enabled'])) {
    fail(422, 'VALIDATION_FAILED', 'enabled must be a boolean.');
  }
  $enabled = $input['enabled'] ? 1 : 0;

  $db->beginTransaction();
  $row = fetchViewForUpdate($db, $viewId);
  requireRevision((int)$row['revision'], $revision);
  $stmt = $db->prepare('
    update ' . calibrationTable('view') . '
    set enabled = :enabled,
        is_default = case when :disable_default = 1 then 0 else is_default end,
        revision = revision + 1,
        updated_by = :updated_by
    where id = :id
  ');
  $stmt->execute([
    'id' => $viewId,
    'enabled' => $enabled,
    'disable_default' => $enabled === 0 ? 1 : 0,
    'updated_by' => actorUsername($actor),
  ]);

  if ($enabled === 0 && (bool)$row['is_default']) {
    ensureDefaultViewForComposition($db, (int)$row['composition_id'], $viewId);
  } elseif ($enabled === 1) {
    ensureDefaultViewForComposition($db, (int)$row['composition_id']);
  }

  audit($db, $requestId, 'calibrationSetViewEnabled', null, null, null, $actor, ['viewId' => $viewId, 'enabled' => $enabled]);
  $db->commit();
  return calibrationBootstrapPayload($db);
}

function handleCalibrationActivateProfile(PDO $db, array $input, string $requestId): array
{
  $actor = verifyEmployee($input, approverPermissions());
  ensureCalibrationStorage($db);
  $profileId = positiveId($input['profileId'] ?? 0, 'profileId');
  $db->beginTransaction();
  $stmt = $db->prepare('select id from ' . calibrationTable('profile') . ' where id = :id for update');
  $stmt->execute(['id' => $profileId]);
  if (!$stmt->fetchColumn()) {
    fail(404, 'NOT_FOUND', 'Calibration profile was not found.');
  }

  $stmt = $db->prepare('update ' . calibrationTable('profile') . ' set is_active = 0 where id <> :id and is_active = 1');
  $stmt->execute(['id' => $profileId]);
  $stmt = $db->prepare("update " . calibrationTable('profile') . " set is_active = 1, status = 'active', revision = revision + 1, updated_by = :updated_by, activated_at = current_timestamp where id = :id");
  $stmt->execute(['id' => $profileId, 'updated_by' => actorUsername($actor)]);
  audit($db, $requestId, 'calibrationActivateProfile', null, null, null, $actor, ['profileId' => $profileId]);
  $db->commit();
  return calibrationBootstrapPayload($db);
}

function ensureCalibrationStorage(PDO $db): void
{
  foreach ([TABLE_CALIBRATION_PROFILE, TABLE_CALIBRATION_COMPOSITION, TABLE_CALIBRATION_VIEW] as $table) {
    assertIdentifier($table);
  }

  installCalibrationTablesForAdmin($db);
  seedDefaultCalibrationProfileForAdmin($db);
}

function installCalibrationTablesForAdmin(PDO $db): void
{
  if (!calibrationTableExists($db, TABLE_CALIBRATION_PROFILE)) {
    $db->exec("
      create table " . calibrationTable('profile') . "
      (
        id             int unsigned auto_increment primary key,
        profile_key    varchar(80)                         not null,
        name           varchar(160)                        not null,
        schema_version int unsigned                         not null default 1,
        status         varchar(20)                          not null default 'draft',
        revision       int unsigned                         not null default 1,
        is_active      tinyint(1)                          not null default 0,
        created_by     varchar(120)                        null,
        updated_by     varchar(120)                        null,
        created_at     timestamp                            not null default CURRENT_TIMESTAMP,
        updated_at     timestamp                            not null default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
        activated_at   timestamp                            null default null,
        unique key uq_profile_key (profile_key),
        key active_status (is_active, status)
      ) engine=InnoDB default charset=utf8mb4;
    ");
  }

  if (!calibrationTableExists($db, TABLE_CALIBRATION_COMPOSITION)) {
    $db->exec("
      create table " . calibrationTable('composition') . "
      (
        id                       int unsigned auto_increment primary key,
        profile_id               int unsigned                         not null,
        composition_key          varchar(80)                          not null,
        label                    varchar(160)                         not null,
        active_slots_json        text                                 not null,
        startup_sequence_json    longtext                             not null,
        natural_ring_layout_json longtext                             not null,
        default_framing_json     text                                 not null,
        enabled                  tinyint(1)                            not null default 1,
        sort_order               int                                   not null default 0,
        revision                 int unsigned                          not null default 1,
        created_at               timestamp                             not null default CURRENT_TIMESTAMP,
        updated_at               timestamp                             not null default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
        unique key uq_profile_composition (profile_id, composition_key),
        key profile_enabled_sort (profile_id, enabled, sort_order),
        constraint fk_calibration_composition_profile foreign key (profile_id) references " . calibrationTable('profile') . " (id) on delete cascade
      ) engine=InnoDB default charset=utf8mb4;
    ");
  }

  if (!calibrationTableExists($db, TABLE_CALIBRATION_VIEW)) {
    $db->exec("
      create table " . calibrationTable('view') . "
      (
        id               int unsigned auto_increment primary key,
        composition_id   int unsigned                         not null,
        view_key         varchar(80)                          not null,
        name             varchar(160)                         not null,
        enabled          tinyint(1)                            not null default 1,
        is_default       tinyint(1)                            not null default 0,
        sort_order       int                                   not null default 0,
        camera_json      longtext                             not null,
        ring_layout_json longtext                             not null,
        framing_json     text                                 not null,
        revision         int unsigned                          not null default 1,
        created_by       varchar(120)                         null,
        updated_by       varchar(120)                         null,
        created_at       timestamp                             not null default CURRENT_TIMESTAMP,
        updated_at       timestamp                             not null default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
        unique key uq_composition_view (composition_id, view_key),
        key composition_enabled_sort (composition_id, enabled, sort_order),
        constraint fk_calibration_view_composition foreign key (composition_id) references " . calibrationTable('composition') . " (id) on delete cascade
      ) engine=InnoDB default charset=utf8mb4;
    ");
  }
}

function calibrationTableExists(PDO $db, string $table): bool
{
  $stmt = $db->prepare('
    select 1
    from information_schema.tables
    where table_schema = database()
      and table_name = :table_name
    limit 1
  ');
  $stmt->execute(['table_name' => assertIdentifier($table)]);
  return (bool)$stmt->fetchColumn();
}

function seedDefaultCalibrationProfileForAdmin(PDO $db): void
{
  $count = (int)$db->query('select count(*) from ' . calibrationTable('profile'))->fetchColumn();
  if ($count > 0) {
    return;
  }

  $db->beginTransaction();
  try {
    $stmt = $db->prepare("
      insert into " . calibrationTable('profile') . "
        (profile_key, name, schema_version, status, revision, is_active, created_by, updated_by, activated_at)
      values
        (:profile_key, :name, 1, 'active', 1, 1, 'migration-2.7.10.1', 'migration-2.7.10.1', current_timestamp)
    ");
    $stmt->execute([
      'profile_key' => 'default-2-7-10',
      'name' => 'Default calibration migrated from 2.7.10',
    ]);
    $profileId = (int)$db->lastInsertId();

    foreach (defaultCalibrationCompositionsForAdmin() as $composition) {
      $stmt = $db->prepare("
        insert into " . calibrationTable('composition') . "
          (profile_id, composition_key, label, active_slots_json, startup_sequence_json, natural_ring_layout_json, default_framing_json, enabled, sort_order, revision)
        values
          (:profile_id, :composition_key, :label, :active_slots_json, :startup_sequence_json, :natural_ring_layout_json, :default_framing_json, 1, :sort_order, 1)
      ");
      $stmt->execute([
        'profile_id' => $profileId,
        'composition_key' => $composition['composition_key'],
        'label' => $composition['label'],
        'active_slots_json' => encodeCalibrationJson($composition['active_slots']),
        'startup_sequence_json' => encodeCalibrationJson($composition['startup_sequence']),
        'natural_ring_layout_json' => encodeCalibrationJson($composition['natural_ring_layout']),
        'default_framing_json' => encodeCalibrationJson($composition['default_framing']),
        'sort_order' => $composition['sort_order'],
      ]);
      $compositionId = (int)$db->lastInsertId();

      foreach ($composition['views'] as $view) {
        $stmt = $db->prepare("
          insert into " . calibrationTable('view') . "
            (composition_id, view_key, name, enabled, is_default, sort_order, camera_json, ring_layout_json, framing_json, revision, created_by, updated_by)
          values
            (:composition_id, :view_key, :name, 1, :is_default, :sort_order, :camera_json, :ring_layout_json, :framing_json, 1, 'migration-2.7.10.1', 'migration-2.7.10.1')
        ");
        $stmt->execute([
          'composition_id' => $compositionId,
          'view_key' => $view['view_key'],
          'name' => $view['name'],
          'is_default' => $view['is_default'] ? 1 : 0,
          'sort_order' => $view['sort_order'],
          'camera_json' => encodeCalibrationJson($view['camera']),
          'ring_layout_json' => encodeCalibrationJson($view['ring_layout']),
          'framing_json' => encodeCalibrationJson($view['framing']),
        ]);
      }
    }
    $db->commit();
  } catch (Throwable $error) {
    rollbackCalibrationTransaction($db);
    throw $error;
  }
}

function defaultCalibrationCompositionsForAdmin(): array
{
  $pairViews = [
    defaultCalibrationViewForAdmin('pair', 'Paar', 'all', 0, -M_PI / 2, M_PI / 2.6, 23.5, true),
    defaultCalibrationViewForAdmin('ring0-outside', 'D außen', 'ring0', 10, -M_PI / 2, M_PI / 2.6, 15.5),
    defaultCalibrationViewForAdmin('ring0-inside', 'D innen', 'ring0', 20, M_PI / 2, M_PI / 2.2, 15.5),
    defaultCalibrationViewForAdmin('ring1-outside', 'H außen', 'ring1', 30, -M_PI / 2, M_PI / 2.6, 15.5),
    defaultCalibrationViewForAdmin('ring1-inside', 'H innen', 'ring1', 40, M_PI / 2, M_PI / 2.2, 15.5),
  ];

  return [
    defaultCalibrationCompositionForAdmin('wedding-pair', 'Trauringpaar', [0, 1], 0, $pairViews),
    defaultCalibrationCompositionForAdmin('wedding-plus-engagement', 'Trauringpaar mit Verlobungsring', [0, 1, 2], 10, $pairViews),
    defaultCalibrationCompositionForAdmin('wedding-plus-memoire', 'Trauringpaar mit Memoirering', [0, 1, 3], 20, $pairViews),
    defaultCalibrationCompositionForAdmin('wedding-plus-both', 'Trauringpaar mit Verlobungsring und Memoirering', [0, 1, 2, 3], 30, $pairViews),
    defaultCalibrationCompositionForAdmin('engagement-only', 'Verlobungsring', [2], 40, [
      defaultCalibrationViewForAdmin('engagement-outside', 'Verlobungsring außen', 'ring2', 0, -M_PI / 2, M_PI / 2.6, 15.5, true),
      defaultCalibrationViewForAdmin('engagement-inside', 'Verlobungsring innen', 'ring2', 10, M_PI / 2, M_PI / 2.2, 15.5),
    ]),
    defaultCalibrationCompositionForAdmin('memoire-only', 'Memoirering', [3], 50, [
      defaultCalibrationViewForAdmin('memoire-outside', 'Memoirering außen', 'ring3', 0, -M_PI / 2, M_PI / 2.6, 15.5, true),
      defaultCalibrationViewForAdmin('memoire-inside', 'Memoirering innen', 'ring3', 10, M_PI / 2, M_PI / 2.2, 15.5),
    ]),
  ];
}

function defaultCalibrationCompositionForAdmin(string $key, string $label, array $slots, int $sortOrder, array $views): array
{
  return [
    'composition_key' => $key,
    'label' => $label,
    'active_slots' => $slots,
    'startup_sequence' => ['enabled' => false, 'delayMs' => 0, 'durationMs' => 1200, 'easing' => 'ease-in-out', 'interruptOnUserInput' => true],
    'natural_ring_layout' => ['rings' => []],
    'default_framing' => ['fitMode' => 'zoom-out-only', 'includeShadowEnvelope' => true],
    'sort_order' => $sortOrder,
    'views' => $views,
  ];
}

function defaultCalibrationViewForAdmin(string $key, string $name, string $focus, int $sortOrder, float $alpha, float $beta, float $orthoHeight, bool $default = false): array
{
  $paddingBottom = $focus === 'all' ? 0.18 : 0.24;
  return [
    'view_key' => $key,
    'name' => $name,
    'is_default' => $default,
    'sort_order' => $sortOrder,
    'camera' => [
      'alpha' => $alpha,
      'beta' => $beta,
      'target' => [0, 10, 0],
      'projection' => [
        'mode' => 'orthographic',
        'orthoHeight' => $orthoHeight,
        'radius' => 60,
        'screenOffsetX' => 0,
        'screenOffsetY' => 0,
      ],
      'safety' => [
        'fitMode' => 'zoom-out-only',
        'paddingTop' => 0.08,
        'paddingRight' => 0.1,
        'paddingBottom' => $paddingBottom,
        'paddingLeft' => 0.1,
        'includeShadowEnvelope' => true,
        'shadowExtraBottom' => 0.18,
        'shadowExtraLeft' => 0.05,
        'shadowExtraRight' => 0.05,
      ],
      'focus' => $focus,
      'targetMode' => 'selection-center',
    ],
    'ring_layout' => ['rings' => []],
    'framing' => ['fitMode' => 'zoom-out-only', 'includeShadowEnvelope' => true],
  ];
}

function fetchActiveCalibrationProfileRow(PDO $db): ?array
{
  $stmt = $db->query("select * from " . calibrationTable('profile') . " where is_active = 1 and status = 'active' order by activated_at desc, id desc limit 1");
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  return $row ?: null;
}

function hydrateCalibrationProfileForAdmin(PDO $db, array $profile, bool $includeDisabled): array
{
  $sql = 'select * from ' . calibrationTable('composition') . ' where profile_id = :profile_id';
  if (!$includeDisabled) {
    $sql .= ' and enabled = 1';
  }
  $sql .= ' order by sort_order asc, composition_key asc';
  $stmt = $db->prepare($sql);
  $stmt->execute(['profile_id' => (int)$profile['id']]);
  $compositions = [];
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $composition) {
    $compositions[] = hydrateCalibrationCompositionForAdmin($db, $composition, $includeDisabled);
  }
  return [
    'id' => (int)$profile['id'],
    'schemaVersion' => (int)$profile['schema_version'],
    'profileKey' => $profile['profile_key'],
    'name' => $profile['name'],
    'status' => $profile['status'],
    'revision' => (int)$profile['revision'],
    'isActive' => (bool)$profile['is_active'],
    'compositions' => $compositions,
  ];
}

function hydrateCalibrationCompositionForAdmin(PDO $db, array $composition, bool $includeDisabled): array
{
  $sql = 'select * from ' . calibrationTable('view') . ' where composition_id = :composition_id';
  if (!$includeDisabled) {
    $sql .= ' and enabled = 1';
  }
  $sql .= ' order by sort_order asc, name asc';
  $stmt = $db->prepare($sql);
  $stmt->execute(['composition_id' => (int)$composition['id']]);
  $views = [];
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $view) {
    $views[] = [
      'id' => (int)$view['id'],
      'viewKey' => $view['view_key'],
      'name' => $view['name'],
      'enabled' => (bool)$view['enabled'],
      'isDefault' => (bool)$view['is_default'],
      'sortOrder' => (int)$view['sort_order'],
      'camera' => decodeCalibrationJson((string)$view['camera_json'], 'camera_json'),
      'ringLayout' => decodeCalibrationJson((string)$view['ring_layout_json'], 'ring_layout_json'),
      'framing' => decodeCalibrationJson((string)$view['framing_json'], 'framing_json'),
      'revision' => (int)$view['revision'],
      'updatedAt' => $view['updated_at'],
    ];
  }
  return [
    'id' => (int)$composition['id'],
    'compositionKey' => $composition['composition_key'],
    'label' => $composition['label'],
    'activeSlots' => decodeCalibrationJson((string)$composition['active_slots_json'], 'active_slots_json'),
    'startupSequence' => decodeCalibrationJson((string)$composition['startup_sequence_json'], 'startup_sequence_json'),
    'naturalRingLayout' => decodeCalibrationJson((string)$composition['natural_ring_layout_json'], 'natural_ring_layout_json'),
    'defaultFraming' => decodeCalibrationJson((string)$composition['default_framing_json'], 'default_framing_json'),
    'enabled' => (bool)$composition['enabled'],
    'sortOrder' => (int)$composition['sort_order'],
    'revision' => (int)$composition['revision'],
    'views' => $views,
  ];
}

function fetchCompositionForUpdate(PDO $db, int $compositionId): array
{
  $stmt = $db->prepare('select * from ' . calibrationTable('composition') . ' where id = :id for update');
  $stmt->execute(['id' => $compositionId]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$row) {
    fail(404, 'NOT_FOUND', 'Calibration composition was not found.');
  }
  return $row;
}

function fetchViewForUpdate(PDO $db, int $viewId): array
{
  $stmt = $db->prepare('select * from ' . calibrationTable('view') . ' where id = :id for update');
  $stmt->execute(['id' => $viewId]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$row) {
    fail(404, 'NOT_FOUND', 'Calibration view was not found.');
  }
  return $row;
}

function setDefaultView(PDO $db, int $compositionId, int $viewId): void
{
  $stmt = $db->prepare('
    select id
    from ' . calibrationTable('view') . '
    where id = :view_id
      and composition_id = :composition_id
      and enabled = 1
    for update
  ');
  $stmt->execute([
    'view_id' => $viewId,
    'composition_id' => $compositionId,
  ]);
  if (!$stmt->fetchColumn()) {
    fail(404, 'NOT_FOUND', 'An enabled calibration view was not found in the selected composition.');
  }

  $stmt = $db->prepare('
    update ' . calibrationTable('view') . '
    set is_default = 0,
        revision = revision + 1
    where composition_id = :composition_id
      and id <> :view_id
      and is_default = 1
  ');
  $stmt->execute([
    'composition_id' => $compositionId,
    'view_id' => $viewId,
  ]);

  $stmt = $db->prepare('
    update ' . calibrationTable('view') . '
    set is_default = 1,
        revision = revision + 1
    where composition_id = :composition_id
      and id = :view_id
      and is_default = 0
  ');
  $stmt->execute([
    'composition_id' => $compositionId,
    'view_id' => $viewId,
  ]);
}

function ensureDefaultViewForComposition(PDO $db, int $compositionId, ?int $excludeViewId = null): void
{
  $stmt = $db->prepare('
    select id
    from ' . calibrationTable('view') . '
    where composition_id = :composition_id
      and is_default = 1
      and enabled = 1
    limit 1
  ');
  $stmt->execute(['composition_id' => $compositionId]);
  if ($stmt->fetchColumn()) {
    return;
  }

  $sql = '
    select id
    from ' . calibrationTable('view') . '
    where composition_id = :composition_id
      and enabled = 1
  ';
  $params = ['composition_id' => $compositionId];
  if ($excludeViewId !== null) {
    $sql .= ' and id <> :exclude_view_id';
    $params['exclude_view_id'] = $excludeViewId;
  }
  $sql .= ' order by sort_order asc, id asc limit 1 for update';

  $stmt = $db->prepare($sql);
  $stmt->execute($params);
  $replacementId = (int)$stmt->fetchColumn();
  if ($replacementId > 0) {
    setDefaultView($db, $compositionId, $replacementId);
  }
}

function viewSqlPayload(int $compositionId, array $view, array $actor, string $viewKey, string $name): array
{
  $enabled = calibrationBooleanValue($view, 'enabled', true);
  $isDefault = calibrationBooleanValue($view, 'isDefault', false);
  if ($enabled === 0 && $isDefault === 1) {
    fail(422, 'VALIDATION_FAILED', 'A disabled calibration view cannot be the default view.');
  }

  return [
    'composition_id' => $compositionId,
    'view_key' => $viewKey,
    'name' => $name,
    'enabled' => $enabled,
    'is_default' => $isDefault,
    'sort_order' => (int)($view['sortOrder'] ?? 0),
    'camera_json' => encodeCalibrationJson($view['camera'] ?? null),
    'ring_layout_json' => encodeCalibrationJson($view['ringLayout'] ?? ['rings' => []]),
    'framing_json' => encodeCalibrationJson($view['framing'] ?? []),
    'created_by' => actorUsername($actor),
    'updated_by' => actorUsername($actor),
  ];
}

function encodeCalibrationJson(mixed $value): string
{
  try {
    $json = json_encode(
      canonicalize($value),
      JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    );
  } catch (JsonException $error) {
    fail(422, 'VALIDATION_FAILED', 'Calibration JSON is invalid.');
  }

  if (strlen($json) > CALIBRATION_JSON_LIMIT) {
    fail(422, 'VALIDATION_FAILED', 'Calibration JSON is too large.');
  }
  return $json;
}

function decodeCalibrationJson(string $json, string $field): mixed
{
  try {
    return json_decode($json, true, 512, JSON_THROW_ON_ERROR);
  } catch (JsonException $error) {
    throw new RuntimeException('Stored calibration JSON is invalid in ' . $field . '.', 0, $error);
  }
}

function calibrationBooleanValue(array $payload, string $key, bool $fallback): int
{
  if (!array_key_exists($key, $payload)) {
    return $fallback ? 1 : 0;
  }
  if (!is_bool($payload[$key])) {
    fail(422, 'VALIDATION_FAILED', $key . ' must be a boolean.');
  }
  return $payload[$key] ? 1 : 0;
}

function requireRevision(int $actual, int $expected): void
{
  if ($actual !== $expected) {
    fail(409, 'CONFLICT', 'Calibration revision changed before saving.');
  }
}

function positiveId(mixed $value, string $label): int
{
  if (is_int($value)) {
    $id = $value;
  } elseif (is_string($value) && preg_match('/^[1-9][0-9]*$/', $value) === 1) {
    $id = (int)$value;
  } else {
    fail(422, 'VALIDATION_FAILED', $label . ' must be a positive integer.');
  }

  if ($id <= 0) {
    fail(422, 'VALIDATION_FAILED', $label . ' must be a positive integer.');
  }
  return $id;
}

function cleanCalibrationKey(string $value): string
{
  $key = strtolower(trim(preg_replace('/[^a-zA-Z0-9_-]+/', '-', $value) ?? '', '-'));
  if ($key === '' || strlen($key) > 80) {
    fail(422, 'VALIDATION_FAILED', 'Calibration key is invalid.');
  }
  return $key;
}

function cleanCalibrationName(mixed $value): string
{
  $name = trim((string)$value);
  $length = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
  if ($name === '' || $length > 160) {
    fail(422, 'VALIDATION_FAILED', 'Calibration name is invalid.');
  }
  return $name;
}
