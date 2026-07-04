<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

$requestId = bin2hex(random_bytes(16));

function jsonResponse(int $status, array $payload): never
{
  http_response_code($status);
  echo json_encode(
    $payload,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
  );
  exit;
}

function configValue(string $constantName, string $environmentName, mixed $default = null): mixed
{
  if (defined($constantName)) {
    return constant($constantName);
  }

  $value = getenv($environmentName);
  return $value === false ? $default : $value;
}

function auditEvent(
  mysqli $db,
  string $requestId,
  string $eventType,
  ?int $userId,
  ?string $username,
  string $submittedUsername,
  ?string $permission,
  string $ipAddress,
  string $userAgent
): void {
  $usernameHash = hash('sha256', mb_strtolower(trim($submittedUsername), 'UTF-8'));

  $stmt = $db->prepare(
    'INSERT INTO user_verification_audit
        (
            request_id,
            event_type,
            user_id,
            username,
            username_hash,
            permission_value,
            ip_address,
            user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  $stmt->bind_param(
    'ssisssss',
    $requestId,
    $eventType,
    $userId,
    $username,
    $usernameHash,
    $permission,
    $ipAddress,
    $userAgent
  );
  $stmt->execute();
  $stmt->close();
}

function genericFailure(string $requestId, int $status = 401, string $code = 'INVALID_CREDENTIALS'): never
{
  jsonResponse($status, [
    'ok' => false,
    'verified' => false,
    'error' => [
      'code' => $code,
      'message' => $code === 'RATE_LIMITED'
        ? 'Zu viele Versuche. Bitte später erneut versuchen.'
        : 'Login oder PIN ungültig.',
    ],
    'requestId' => $requestId,
  ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Allow: POST');
  jsonResponse(405, [
    'ok' => false,
    'verified' => false,
    'error' => [
      'code' => 'METHOD_NOT_ALLOWED',
      'message' => 'Nur POST ist erlaubt.',
    ],
    'requestId' => $requestId,
  ]);
}

$localConfig = __DIR__ . '/user-verification.config.local.php';
if (is_file($localConfig)) {
  require $localConfig;
}

$dbHost = (string) configValue('VERIFY_DB_HOST', 'LUNA_VERIFY_DB_HOST', '');
$dbPort = (int) configValue('VERIFY_DB_PORT', 'LUNA_VERIFY_DB_PORT', 3306);
$dbName = (string) configValue('VERIFY_DB_NAME', 'LUNA_VERIFY_DB_NAME', '');
$dbUsername = (string) configValue('VERIFY_DB_USERNAME', 'LUNA_VERIFY_DB_USERNAME', '');
$dbPassword = (string) configValue('VERIFY_DB_PASSWORD', 'LUNA_VERIFY_DB_PASSWORD', '');
$internalKey = (string) configValue('VERIFY_INTERNAL_KEY', 'LUNA_VERIFY_INTERNAL_KEY', '');
$maxAttempts = max(1, (int) configValue('VERIFY_MAX_ATTEMPTS', 'LUNA_VERIFY_MAX_ATTEMPTS', 5));
$windowSeconds = max(60, (int) configValue('VERIFY_WINDOW_SECONDS', 'LUNA_VERIFY_WINDOW_SECONDS', 900));
$blockSeconds = max(60, (int) configValue('VERIFY_BLOCK_SECONDS', 'LUNA_VERIFY_BLOCK_SECONDS', 900));

if ($dbHost === '' || $dbName === '' || $dbUsername === '' || $dbPassword === '' || $internalKey === '') {
  error_log("[user-verification][$requestId] Missing server configuration.");
  jsonResponse(500, [
    'ok' => false,
    'verified' => false,
    'error' => [
      'code' => 'SERVER_CONFIGURATION_ERROR',
      'message' => 'Der Verifikationsdienst ist nicht vollständig konfiguriert.',
    ],
    'requestId' => $requestId,
  ]);
}

$providedKey = (string) ($_SERVER['HTTP_X_INTERNAL_VERIFICATION_KEY'] ?? '');
if ($providedKey === '' || !hash_equals($internalKey, $providedKey)) {
  jsonResponse(403, [
    'ok' => false,
    'verified' => false,
    'error' => [
      'code' => 'FORBIDDEN',
      'message' => 'Der Zugriff wurde abgelehnt.',
    ],
    'requestId' => $requestId,
  ]);
}

$contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
try {
  if (str_contains($contentType, 'application/json')) {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw === false ? '' : $raw, true, 32, JSON_THROW_ON_ERROR);
  } else {
    $input = $_POST;
  }
} catch (JsonException) {
  jsonResponse(400, [
    'ok' => false,
    'verified' => false,
    'error' => [
      'code' => 'INVALID_JSON',
      'message' => 'Die Anfrage enthält kein gültiges JSON.',
    ],
    'requestId' => $requestId,
  ]);
}

$username = trim((string) ($input['username'] ?? ''));
$pin = (string) ($input['pin'] ?? $input['password'] ?? '');

if (
  $username === ''
  || $pin === ''
  || mb_strlen($username, 'UTF-8') > 100
  || strlen($pin) > 255
) {
  genericFailure($requestId);
}

$ipAddress = substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
$userAgent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500);
$identityHash = hash(
  'sha256',
  mb_strtolower($username, 'UTF-8') . '|' . $ipAddress
);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
  $db = new mysqli($dbHost, $dbUsername, $dbPassword, $dbName, $dbPort);
  $db->set_charset('utf8mb4');
  $db->begin_transaction();

  $attempts = 0;
  $windowStartedAt = null;
  $blockedUntil = null;

  $rateStmt = $db->prepare(
    'SELECT attempts, window_started_at, blocked_until
         FROM user_verification_rate_limit
         WHERE identity_hash = ?
         FOR UPDATE'
  );
  $rateStmt->bind_param('s', $identityHash);
  $rateStmt->execute();
  $rateStmt->bind_result($attemptsResult, $windowStartedResult, $blockedUntilResult);
  if ($rateStmt->fetch()) {
    $attempts = (int) $attemptsResult;
    $windowStartedAt = $windowStartedResult !== null
      ? new DateTimeImmutable($windowStartedResult, new DateTimeZone('UTC'))
      : null;
    $blockedUntil = $blockedUntilResult !== null
      ? new DateTimeImmutable($blockedUntilResult, new DateTimeZone('UTC'))
      : null;
  }
  $rateStmt->close();

  $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));

  if ($blockedUntil !== null && $blockedUntil > $now) {
    auditEvent(
      $db,
      $requestId,
      'blocked',
      null,
      null,
      $username,
      null,
      $ipAddress,
      $userAgent
    );
    $db->commit();

    $retryAfter = max(1, $blockedUntil->getTimestamp() - $now->getTimestamp());
    header('Retry-After: ' . $retryAfter);
    genericFailure($requestId, 429, 'RATE_LIMITED');
  }

  if (
    $windowStartedAt === null
    || ($now->getTimestamp() - $windowStartedAt->getTimestamp()) > $windowSeconds
  ) {
    $attempts = 0;
    $windowStartedAt = $now;
    $blockedUntil = null;
  }

  $userStmt = $db->prepare(
    'SELECT id, username, password, berechtigung
         FROM users
         WHERE username = ?
         LIMIT 1'
  );
  $userStmt->bind_param('s', $username);
  $userStmt->execute();
  $userStmt->bind_result($userIdResult, $dbUsernameResult, $passwordHashResult, $permissionResult);

  $userFound = $userStmt->fetch();
  $userStmt->close();

  $userId = $userFound ? (int) $userIdResult : null;
  $dbUsernameValue = $userFound ? (string) $dbUsernameResult : null;
  $permission = $userFound && $permissionResult !== null ? (string) $permissionResult : null;

  // Use a valid hash even for unknown users to reduce obvious timing differences.
  $hashForVerification = $userFound
    ? (string) $passwordHashResult
    : password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);

  $verified = password_verify($pin, $hashForVerification);

  if (!$userFound || !$verified) {
    $attempts++;
    $newBlockedUntil = $attempts >= $maxAttempts
      ? $now->modify('+' . $blockSeconds . ' seconds')
      : null;

    $windowSql = $windowStartedAt->format('Y-m-d H:i:s.u');
    $blockedSql = $newBlockedUntil?->format('Y-m-d H:i:s.u');
    $nowSql = $now->format('Y-m-d H:i:s.u');

    $upsert = $db->prepare(
      'INSERT INTO user_verification_rate_limit
            (
                identity_hash,
                attempts,
                window_started_at,
                blocked_until,
                last_attempt_at,
                last_ip
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                attempts = VALUES(attempts),
                window_started_at = VALUES(window_started_at),
                blocked_until = VALUES(blocked_until),
                last_attempt_at = VALUES(last_attempt_at),
                last_ip = VALUES(last_ip)'
    );
    $upsert->bind_param(
      'sissss',
      $identityHash,
      $attempts,
      $windowSql,
      $blockedSql,
      $nowSql,
      $ipAddress
    );
    $upsert->execute();
    $upsert->close();

    auditEvent(
      $db,
      $requestId,
      $newBlockedUntil !== null ? 'blocked' : 'failure',
      null,
      null,
      $username,
      null,
      $ipAddress,
      $userAgent
    );

    $db->commit();

    if ($newBlockedUntil !== null) {
      header('Retry-After: ' . $blockSeconds);
      genericFailure($requestId, 429, 'RATE_LIMITED');
    }

    genericFailure($requestId);
  }

  $deleteRate = $db->prepare(
    'DELETE FROM user_verification_rate_limit WHERE identity_hash = ?'
  );
  $deleteRate->bind_param('s', $identityHash);
  $deleteRate->execute();
  $deleteRate->close();

  auditEvent(
    $db,
    $requestId,
    'success',
    $userId,
    $dbUsernameValue,
    $username,
    $permission,
    $ipAddress,
    $userAgent
  );

  $db->commit();

  jsonResponse(200, [
    'ok' => true,
    'verified' => true,
    'user' => [
      'id' => $userId,
      'username' => $dbUsernameValue,
      'permission' => $permission,
    ],
    'verifiedAt' => $now->format(DATE_ATOM),
    'requestId' => $requestId,
  ]);
} catch (Throwable $exception) {
  if (isset($db) && $db instanceof mysqli) {
    try {
      $db->rollback();
    } catch (Throwable) {
      // Ignore rollback failure; never expose database details to the caller.
    }
  }

  error_log(
    '[user-verification][' . $requestId . '] '
    . get_class($exception) . ': ' . $exception->getMessage()
  );

  jsonResponse(500, [
    'ok' => false,
    'verified' => false,
    'error' => [
      'code' => 'SERVER_ERROR',
      'message' => 'Die Verifikation konnte nicht abgeschlossen werden.',
    ],
    'requestId' => $requestId,
  ]);
}
