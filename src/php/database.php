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
