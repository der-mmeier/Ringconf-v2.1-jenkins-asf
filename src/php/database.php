<?php

namespace One;
include __DIR__."/config.php";

use \PDO;
use \PDOException;

class Database extends PDO
{
    public function __construct()
    {
        try {
            if (DB_DSN === '') {
                throw new PDOException('Missing ONERINGCONF_DB_DSN configuration');
            }

            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            parent::__construct(DB_DSN, DB_USERNAME, DB_PASSWORD, $options);

            if (!$this->tableExists(TABLE_DATA)) {
                $this->exec("
                create table ".TABLE_DATA."
                (
                    id      varchar(50) not null primary key,
                    value   text        null
                );");
            }
            if (!$this->tableExists(TABLE_PRESET)) {
                $this->exec("
                create table ".TABLE_PRESET."
                (
                    id       varchar(15)                   not null primary key,
                    preset_0 text                             null,
                    preset_1 text                             null,
                    preset_2 text                             null,
                    preset_3 text                             null,
                    img      longtext                         null,
                    date     timestamp default CURRENT_TIMESTAMP not null
                );");
            }
            $this->ensureColumn(TABLE_PRESET, 'preset_2', 'text null', 'preset_1');
            $this->ensureColumn(TABLE_PRESET, 'preset_3', 'text null', 'preset_2');
            $this->installCalibrationTables();
            $this->seedDefaultCalibrationProfile();

        } catch (PDOException $e) {
            print "Error!: " . $e->getMessage() . "<br/>";
            die();
        }
    }

    public function tableExists($table): bool
    {
        $tables = $this->query("show tables")->fetchAll(PDO::FETCH_GROUP);
        if (in_array($table, array_keys($tables))) {
            return true;
        }

        return false;
    }

    public function columnExists($table, $column): bool
    {
        $stmt = $this->prepare("
            SELECT COUNT(*)
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table_name
              AND COLUMN_NAME = :column_name
        ");
        $stmt->execute([
            'table_name' => $table,
            'column_name' => $column,
        ]);

        return (int)$stmt->fetchColumn() > 0;
    }

    private function ensureColumn($table, $column, $definition, $after): void
    {
        if (!$this->columnExists($table, $column)) {
            $this->exec("ALTER TABLE " . $table . " ADD COLUMN " . $column . " " . $definition . " AFTER " . $after);
        }
    }

    private function installCalibrationTables(): void
    {
        if (!$this->tableExists(TABLE_CALIBRATION_PROFILE)) {
            $this->exec("
                create table ".TABLE_CALIBRATION_PROFILE."
                (
                    id             int unsigned auto_increment primary key,
                    profile_key    varchar(80)                         not null,
                    name           varchar(160)                        not null,
                    schema_version int unsigned default 1              not null,
                    status         varchar(20) default 'draft'         not null,
                    revision       int unsigned default 1              not null,
                    is_active      tinyint(1) default 0                not null,
                    created_by     varchar(120)                        null,
                    updated_by     varchar(120)                        null,
                    created_at     timestamp default CURRENT_TIMESTAMP not null,
                    updated_at     timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
                    activated_at   timestamp null,
                    unique key uq_profile_key (profile_key),
                    key active_status (is_active, status)
                );");
        }

        if (!$this->tableExists(TABLE_CALIBRATION_COMPOSITION)) {
            $this->exec("
                create table ".TABLE_CALIBRATION_COMPOSITION."
                (
                    id                       int unsigned auto_increment primary key,
                    profile_id               int unsigned                         not null,
                    composition_key          varchar(80)                          not null,
                    label                    varchar(160)                         not null,
                    active_slots_json        text                                 not null,
                    startup_sequence_json    longtext                             not null,
                    natural_ring_layout_json longtext                             not null,
                    default_framing_json     text                                 not null,
                    enabled                  tinyint(1) default 1                 not null,
                    sort_order               int default 0                        not null,
                    revision                 int unsigned default 1               not null,
                    created_at               timestamp default CURRENT_TIMESTAMP  not null,
                    updated_at               timestamp default CURRENT_TIMESTAMP  not null on update CURRENT_TIMESTAMP,
                    unique key uq_profile_composition (profile_id, composition_key),
                    key profile_enabled_sort (profile_id, enabled, sort_order),
                    constraint fk_calibration_composition_profile foreign key (profile_id) references ".TABLE_CALIBRATION_PROFILE." (id) on delete cascade
                );");
        }

        if (!$this->tableExists(TABLE_CALIBRATION_VIEW)) {
            $this->exec("
                create table ".TABLE_CALIBRATION_VIEW."
                (
                    id               int unsigned auto_increment primary key,
                    composition_id   int unsigned                         not null,
                    view_key         varchar(80)                          not null,
                    name             varchar(160)                         not null,
                    enabled          tinyint(1) default 1                 not null,
                    is_default       tinyint(1) default 0                 not null,
                    sort_order       int default 0                        not null,
                    camera_json      longtext                             not null,
                    ring_layout_json longtext                             not null,
                    framing_json     text                                 not null,
                    revision         int unsigned default 1               not null,
                    created_by       varchar(120)                         null,
                    updated_by       varchar(120)                         null,
                    created_at       timestamp default CURRENT_TIMESTAMP  not null,
                    updated_at       timestamp default CURRENT_TIMESTAMP  not null on update CURRENT_TIMESTAMP,
                    unique key uq_composition_view (composition_id, view_key),
                    key composition_enabled_sort (composition_id, enabled, sort_order),
                    constraint fk_calibration_view_composition foreign key (composition_id) references ".TABLE_CALIBRATION_COMPOSITION." (id) on delete cascade
                );");
        }
    }

    private function seedDefaultCalibrationProfile(): void
    {
        $count = (int)$this->query("select count(*) from ".TABLE_CALIBRATION_PROFILE)->fetchColumn();
        if ($count > 0) {
            return;
        }

        $this->beginTransaction();
        try {
            $stmt = $this->prepare("
                insert into ".TABLE_CALIBRATION_PROFILE."
                    (profile_key, name, schema_version, status, revision, is_active, created_by, updated_by, activated_at)
                values
                    (:profile_key, :name, 1, 'active', 1, 1, 'migration-2.7.10.1', 'migration-2.7.10.1', current_timestamp)
            ");
            $stmt->execute([
                'profile_key' => 'default-2-7-10',
                'name' => 'Default calibration migrated from 2.7.10',
            ]);
            $profileId = (int)$this->lastInsertId();

            foreach ($this->defaultCalibrationCompositions() as $composition) {
                $stmt = $this->prepare("
                    insert into ".TABLE_CALIBRATION_COMPOSITION."
                        (profile_id, composition_key, label, active_slots_json, startup_sequence_json, natural_ring_layout_json, default_framing_json, enabled, sort_order, revision)
                    values
                        (:profile_id, :composition_key, :label, :active_slots_json, :startup_sequence_json, :natural_ring_layout_json, :default_framing_json, 1, :sort_order, 1)
                ");
                $stmt->execute([
                    'profile_id' => $profileId,
                    'composition_key' => $composition['composition_key'],
                    'label' => $composition['label'],
                    'active_slots_json' => json_encode($composition['active_slots'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'startup_sequence_json' => json_encode($composition['startup_sequence'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'natural_ring_layout_json' => json_encode($composition['natural_ring_layout'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'default_framing_json' => json_encode($composition['default_framing'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'sort_order' => $composition['sort_order'],
                ]);
                $compositionId = (int)$this->lastInsertId();

                foreach ($composition['views'] as $view) {
                    $stmt = $this->prepare("
                        insert into ".TABLE_CALIBRATION_VIEW."
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
                        'camera_json' => json_encode($view['camera'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        'ring_layout_json' => json_encode($view['ring_layout'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        'framing_json' => json_encode($view['framing'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    ]);
                }
            }
            $this->commit();
        } catch (\Throwable $error) {
            $this->rollBack();
            throw $error;
        }
    }

    public function getActiveCalibrationProfile(): array
    {
        $stmt = $this->query("
            select *
            from ".TABLE_CALIBRATION_PROFILE."
            where is_active = 1 and status = 'active'
            order by activated_at desc, id desc
            limit 1
        ");
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$profile) {
            return ['ok' => false, 'error' => ['code' => 'CALIBRATION_NOT_FOUND', 'message' => 'No active calibration profile exists.']];
        }

        return ['ok' => true, 'data' => $this->hydrateCalibrationProfile($profile)];
    }

    private function hydrateCalibrationProfile(array $profile): array
    {
        $stmt = $this->prepare("
            select *
            from ".TABLE_CALIBRATION_COMPOSITION."
            where profile_id = :profile_id and enabled = 1
            order by sort_order asc, composition_key asc
        ");
        $stmt->execute(['profile_id' => (int)$profile['id']]);
        $compositions = [];
        while ($composition = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $compositions[] = $this->hydrateCalibrationComposition($composition);
        }

        return [
            'schemaVersion' => (int)$profile['schema_version'],
            'profileKey' => $profile['profile_key'],
            'name' => $profile['name'],
            'status' => $profile['status'],
            'revision' => (int)$profile['revision'],
            'compositions' => $compositions,
        ];
    }

    private function hydrateCalibrationComposition(array $composition): array
    {
        $stmt = $this->prepare("
            select *
            from ".TABLE_CALIBRATION_VIEW."
            where composition_id = :composition_id and enabled = 1
            order by sort_order asc, name asc
        ");
        $stmt->execute(['composition_id' => (int)$composition['id']]);
        $views = [];
        while ($view = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $views[] = [
                'id' => (int)$view['id'],
                'viewKey' => $view['view_key'],
                'name' => $view['name'],
                'enabled' => (bool)$view['enabled'],
                'isDefault' => (bool)$view['is_default'],
                'sortOrder' => (int)$view['sort_order'],
                'revision' => (int)$view['revision'],
                'camera' => json_decode((string)$view['camera_json'], true),
                'ringLayout' => json_decode((string)$view['ring_layout_json'], true),
                'framing' => json_decode((string)$view['framing_json'], true),
                'updatedAt' => $view['updated_at'],
            ];
        }

        return [
            'id' => (int)$composition['id'],
            'compositionKey' => $composition['composition_key'],
            'label' => $composition['label'],
            'activeSlots' => json_decode((string)$composition['active_slots_json'], true),
            'startupSequence' => json_decode((string)$composition['startup_sequence_json'], true),
            'naturalRingLayout' => json_decode((string)$composition['natural_ring_layout_json'], true),
            'defaultFraming' => json_decode((string)$composition['default_framing_json'], true),
            'enabled' => (bool)$composition['enabled'],
            'sortOrder' => (int)$composition['sort_order'],
            'revision' => (int)$composition['revision'],
            'views' => $views,
        ];
    }

    private function defaultCalibrationCompositions(): array
    {
        $pairViews = [
            $this->defaultView('pair', 'Paar', 'all', 0, -M_PI / 2, M_PI / 2.6, 23.5, true),
            $this->defaultView('ring0-outside', 'D außen', 'ring0', 10, -M_PI / 2, M_PI / 2.6, 15.5),
            $this->defaultView('ring0-inside', 'D innen', 'ring0', 20, M_PI / 2, M_PI / 2.2, 15.5),
            $this->defaultView('ring1-outside', 'H außen', 'ring1', 30, -M_PI / 2, M_PI / 2.6, 15.5),
            $this->defaultView('ring1-inside', 'H innen', 'ring1', 40, M_PI / 2, M_PI / 2.2, 15.5),
        ];

        return [
            $this->defaultComposition('wedding-pair', 'Trauringpaar', [0, 1], 0, $pairViews),
            $this->defaultComposition('wedding-plus-engagement', 'Trauringpaar mit Verlobungsring', [0, 1, 2], 10, $pairViews),
            $this->defaultComposition('wedding-plus-memoire', 'Trauringpaar mit Memoirering', [0, 1, 3], 20, $pairViews),
            $this->defaultComposition('wedding-plus-both', 'Trauringpaar mit Verlobungsring und Memoirering', [0, 1, 2, 3], 30, $pairViews),
            $this->defaultComposition('engagement-only', 'Verlobungsring', [2], 40, [
                $this->defaultView('engagement-outside', 'Verlobungsring außen', 'ring2', 0, -M_PI / 2, M_PI / 2.6, 15.5, true),
                $this->defaultView('engagement-inside', 'Verlobungsring innen', 'ring2', 10, M_PI / 2, M_PI / 2.2, 15.5),
            ]),
            $this->defaultComposition('memoire-only', 'Memoirering', [3], 50, [
                $this->defaultView('memoire-outside', 'Memoirering außen', 'ring3', 0, -M_PI / 2, M_PI / 2.6, 15.5, true),
                $this->defaultView('memoire-inside', 'Memoirering innen', 'ring3', 10, M_PI / 2, M_PI / 2.2, 15.5),
            ]),
        ];
    }

    private function defaultComposition(string $key, string $label, array $slots, int $sortOrder, array $views): array
    {
        return [
            'composition_key' => $key,
            'label' => $label,
            'active_slots' => $slots,
            'startup_sequence' => ['enabled' => false, 'delayMs' => 0, 'durationMs' => 1200, 'easing' => 'ease-in-out', 'interruptOnUserInput' => true],
            'natural_ring_layout' => ['rings' => []],
            'default_framing' => ['fitMode' => 'zoom-out-only', 'includeShadowEnvelope' => true],
            'enabled' => true,
            'sort_order' => $sortOrder,
            'views' => $views,
        ];
    }

    private function defaultView(string $key, string $name, string $focus, int $sortOrder, float $alpha, float $beta, float $orthoHeight, bool $default = false): array
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

/*    public function importSql($filename)
    {
        $query = '';
        if (!is_file($filename)) {
            if (is_file($filename . '.bak'))
                return;
            else
                apiExit('Error importing SQL file: $filename');
        }

        $sqlScript = file($filename);

        foreach ($sqlScript as $line) {
            $startWith = substr(trim($line), 0, 2);
            $endWith = substr(trim($line), -1, 1);

            if (empty($line) || $startWith == '--' || $startWith == '/*' || $startWith == '//') {
                continue;
            }

            $query = $query . $line;
            if ($endWith == ';') {
                try {
                    $this->query($query);
                } catch (PDOException $exception) {
                    apiExit('Problem in executing the SQL query:' . $exception->getMessage());
                }

                $query = '';
            }
        }

        rename($filename, $filename . '.bak');
        apiExit('SQL file imported successfully');
    }*/
}
