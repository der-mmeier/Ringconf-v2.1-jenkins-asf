<?php
declare(strict_types=1);

// Phase 1: broad CORS for internal testing; restrict to Origin allowlist/Tenant later.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const MAX_BODY_BYTES = 20971520;
const MAX_SCREENSHOT_BYTES = 8388608;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_BLOCK_SECONDS = 3600;

$tmpDir = __DIR__ . '/tmp';
$logDir = __DIR__ . '/logs';
ensureDirectory($tmpDir);
ensureDirectory($logDir);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respondJson(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.');
    }

    enforceRateLimit($tmpDir);

    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > MAX_BODY_BYTES) {
        respondJson(413, 'PAYLOAD_TOO_LARGE', 'The PDF request is too large.');
    }

    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || $rawBody === '') {
        respondJson(400, 'INVALID_JSON', 'The request body is empty.');
    }

    if (strlen($rawBody) > MAX_BODY_BYTES) {
        respondJson(413, 'PAYLOAD_TOO_LARGE', 'The PDF request is too large.');
    }

    $payload = json_decode($rawBody, true);
    if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
        respondJson(400, 'INVALID_JSON', 'The request body is not valid JSON.');
    }

    validatePayload($payload);

    require_once __DIR__ . '/../fpdf/1.9/fpdf.php';

    $imageFiles = [
        'ring1' => saveScreenshot($payload['screenshots']['ring1'] ?? '', $tmpDir, 'ring1'),
        'ring2' => saveScreenshot($payload['screenshots']['ring2'] ?? '', $tmpDir, 'ring2'),
    ];

    $pdf = new RingconfPdf('P', 'mm', 'A4');
    $pdf->SetPayloadMeta(
        (string)$payload['build'],
        (string)$payload['appDataVersion'],
        (string)($payload['appDataHash'] ?? '')
    );
    $pdf->AliasNbPages();
    $pdf->AddPage();
    $pdf->RenderPayload($payload, $imageFiles);

    $filename = sanitizeFilename((string)$payload['presetId']) . '.pdf';
    $output = $pdf->Output('S');

    foreach ($imageFiles as $file) {
        if ($file !== null && is_file($file['path'])) {
            @unlink($file['path']);
        }
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($output));
    echo $output;
} catch (Throwable $exception) {
    logServerError($logDir, $exception);
    respondJson(500, 'PDF_FAILED', 'PDF could not be created.');
}

class RingconfPdf extends FPDF
{
    private string $build = '';
    private string $appDataVersion = '';
    private string $appDataHash = '';

    public function SetPayloadMeta(string $build, string $appDataVersion, string $appDataHash): void
    {
        $this->build = $build;
        $this->appDataVersion = $appDataVersion;
        $this->appDataHash = $appDataHash;
    }

    public function Footer(): void
    {
        $hash = $this->appDataHash !== '' ? substr($this->appDataHash, 0, 12) : '-';
        $this->SetY(-14);
        $this->SetFont('Arial', '', 7);
        $this->SetTextColor(90, 90, 90);
        $this->Cell(0, 5, pdfText('Build ' . $this->build . ' | AppData ' . $this->appDataVersion . ' | Hash ' . $hash), 0, 0, 'C');
    }

    public function RenderPayload(array $payload, array $imageFiles): void
    {
        $isActive = $payload['isActive'];
        $isSingle = !$isActive[0] || !$isActive[1];

        $this->SetMargins(12, 12, 12);
        $this->SetAutoPageBreak(true, 18);
        $this->SetTextColor(20, 20, 20);

        $this->SetFont('Arial', '', 9);
        $this->Cell(90, 6, pdfText('Datum: ' . date('d.m.Y')), 0, 0, 'L');
        $this->Cell(0, 6, pdfText('Preset-ID: ' . $payload['presetId']), 0, 1, 'R');
        $this->Ln(4);

        $this->SetFont('Arial', 'B', 15);
        $this->Cell(0, 8, pdfText('Ringkonfiguration'), 0, 1, 'C');
        $this->Ln(4);

        $imageY = $this->GetY();
        if ($isActive[0]) {
            $this->renderRingImage($imageFiles['ring1'] ?? null, 28, $imageY, 'Ring 1');
        }
        if ($isActive[1]) {
            $x = $isSingle ? 28 : 112;
            $this->renderRingImage($imageFiles['ring2'] ?? null, $x, $imageY, 'Ring 2');
        }
        $this->SetY($imageY + 55);

        foreach ($payload['details'] as $section) {
            if (is_array($section)) {
                $this->renderSection($section, $isActive, $isSingle);
            }
        }

        $this->renderPrice($payload, $isActive, $isSingle);
    }

    private function renderRingImage(?array $imageFile, float $x, float $y, string $label): void
    {
        $this->SetFont('Arial', 'B', 9);
        $this->SetXY($x, $y);
        $this->Cell(54, 5, pdfText($label), 0, 0, 'C');

        if ($imageFile !== null && is_file($imageFile['path'])) {
            $this->Image($imageFile['path'], $x, $y + 6, 54, 42);
            return;
        }

        $this->SetDrawColor(180, 180, 180);
        $this->Rect($x, $y + 6, 54, 42);
        $this->SetFont('Arial', '', 8);
        $this->SetXY($x, $y + 24);
        $this->Cell(54, 5, pdfText('No image'), 0, 0, 'C');
    }

    private function renderSection(array $section, array $isActive, bool $isSingle): void
    {
        $title = sanitizeText((string)($section['section'] ?? ''));
        $rows = $section['data'] ?? [];
        if ($title === '' || !is_array($rows)) {
            return;
        }

        $this->ensureSpace(18);
        $this->SetFont('Arial', 'B', 10);
        $this->SetFillColor(238, 238, 238);
        $this->Cell(0, 7, pdfText($title), 0, 1, 'L', true);

        $columns = $this->getColumns($isActive, $isSingle);
        $this->SetFont('Arial', 'B', 8);
        foreach ($columns as $column) {
            $this->Cell($column['width'], 6, pdfText($column['label']), 1, 0, 'L');
        }
        $this->Ln();

        $this->SetFont('Arial', '', 8);
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $cells = [sanitizeText((string)($row['col_0'] ?? ''))];
            if ($isActive[0]) {
                $cells[] = sanitizeText((string)($row['col_1'] ?? ''));
            }
            if ($isActive[1]) {
                $cells[] = sanitizeText((string)($row['col_2'] ?? ''));
            }

            $height = 6;
            foreach ($cells as $index => $cell) {
                $height = max($height, $this->NbLines($columns[$index]['width'], pdfText($cell)) * 5);
            }

            $this->ensureSpace($height);
            $x = $this->GetX();
            $y = $this->GetY();
            foreach ($cells as $index => $cell) {
                $width = $columns[$index]['width'];
                $this->Rect($x, $y, $width, $height);
                $this->SetXY($x + 1, $y + 1);
                $this->MultiCell($width - 2, 4, pdfText($cell), 0, 'L');
                $x += $width;
                $this->SetXY($x, $y);
            }
            $this->SetY($y + $height);
        }

        $this->Ln(4);
    }

    private function renderPrice(array $payload, array $isActive, bool $isSingle): void
    {
        $rings = $payload['rings'] ?? [];
        $prices = [
            isset($rings[0]['price']) ? (string)$rings[0]['price'] . ' EUR' : '',
            isset($rings[1]['price']) ? (string)$rings[1]['price'] . ' EUR' : '',
        ];

        if ($prices[0] === '' && $prices[1] === '') {
            return;
        }

        $this->ensureSpace(12);
        $this->SetFont('Arial', 'B', 9);
        $columns = $this->getColumns($isActive, $isSingle);
        $this->Cell($columns[0]['width'], 7, pdfText('Preis'), 1, 0, 'L');
        $columnIndex = 1;
        if ($isActive[0]) {
            $this->Cell($columns[$columnIndex]['width'], 7, pdfText($prices[0]), 1, 0, 'L');
            $columnIndex++;
        }
        if ($isActive[1]) {
            $this->Cell($columns[$columnIndex]['width'], 7, pdfText($prices[1]), 1, 0, 'L');
        }
        $this->Ln();
    }

    private function getColumns(array $isActive, bool $isSingle): array
    {
        if ($isSingle) {
            return [
                ['label' => 'Beschreibung', 'width' => 60.0],
                ['label' => $isActive[0] ? 'Ring 1' : 'Ring 2', 'width' => 126.0],
            ];
        }

        return [
            ['label' => 'Beschreibung', 'width' => 50.0],
            ['label' => 'Ring 1', 'width' => 68.0],
            ['label' => 'Ring 2', 'width' => 68.0],
        ];
    }

    private function ensureSpace(float $height): void
    {
        if ($this->GetY() + $height > 276) {
            $this->AddPage();
        }
    }

    private function NbLines(float $w, string $txt): int
    {
        $cw = $this->CurrentFont['cw'];
        if ($w == 0) {
            $w = $this->w - $this->rMargin - $this->x;
        }
        $wmax = ($w - 2 * $this->cMargin) * 1000 / $this->FontSize;
        $s = str_replace("\r", '', $txt);
        $nb = strlen($s);
        if ($nb > 0 && $s[$nb - 1] === "\n") {
            $nb--;
        }
        $sep = -1;
        $i = 0;
        $j = 0;
        $l = 0;
        $nl = 1;
        while ($i < $nb) {
            $c = $s[$i];
            if ($c === "\n") {
                $i++;
                $sep = -1;
                $j = $i;
                $l = 0;
                $nl++;
                continue;
            }
            if ($c === ' ') {
                $sep = $i;
            }
            $l += $cw[$c] ?? 0;
            if ($l > $wmax) {
                if ($sep === -1) {
                    if ($i === $j) {
                        $i++;
                    }
                } else {
                    $i = $sep + 1;
                }
                $sep = -1;
                $j = $i;
                $l = 0;
                $nl++;
            } else {
                $i++;
            }
        }
        return $nl;
    }
}

function validatePayload(array $payload): void
{
    if (($payload['requestVersion'] ?? null) !== 1) {
        respondJson(422, 'VALIDATION_FAILED', 'requestVersion must be 1.');
    }

    $presetId = $payload['presetId'] ?? null;
    if (!is_string($presetId) || !preg_match('/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}(?:-[A-Za-z0-9._-]+)?$/', $presetId)) {
        respondJson(422, 'VALIDATION_FAILED', 'presetId is invalid.');
    }

    foreach (['build', 'appDataVersion'] as $field) {
        if (!isset($payload[$field]) || !is_string($payload[$field]) || trim($payload[$field]) === '') {
            respondJson(422, 'VALIDATION_FAILED', $field . ' is missing.');
        }
    }

    if (!isset($payload['details']) || !is_array($payload['details'])) {
        respondJson(422, 'VALIDATION_FAILED', 'details must be an array.');
    }

    if (!isset($payload['isActive']) || !is_array($payload['isActive']) || count($payload['isActive']) < 2) {
        respondJson(422, 'VALIDATION_FAILED', 'isActive must contain two values.');
    }

    if (!is_bool($payload['isActive'][0]) || !is_bool($payload['isActive'][1])) {
        respondJson(422, 'VALIDATION_FAILED', 'isActive must contain booleans.');
    }

    if (!isset($payload['screenshots']) || !is_array($payload['screenshots'])) {
        respondJson(422, 'VALIDATION_FAILED', 'screenshots is missing.');
    }

    foreach (['ring1', 'ring2'] as $key) {
        validateScreenshotValue($payload['screenshots'][$key] ?? '');
    }
}

function validateScreenshotValue(mixed $value): void
{
    if ($value === '' || $value === null) {
        return;
    }

    if (!is_string($value)) {
        respondJson(422, 'VALIDATION_FAILED', 'Screenshot is invalid.');
    }

    if (!preg_match('#^data:(image/png|image/jpeg);base64,[A-Za-z0-9+/=\r\n]+$#', $value)) {
        respondJson(422, 'VALIDATION_FAILED', 'Screenshot MIME is not allowed.');
    }
}

function saveScreenshot(mixed $value, string $tmpDir, string $label): ?array
{
    if ($value === '' || $value === null) {
        return null;
    }

    preg_match('#^data:(image/png|image/jpeg);base64,(.+)$#s', (string)$value, $matches);
    $mime = $matches[1] ?? '';
    $binary = base64_decode(str_replace(["\r", "\n"], '', $matches[2] ?? ''), true);
    if ($binary === false) {
        respondJson(422, 'VALIDATION_FAILED', 'Screenshot could not be read.');
    }
    if (strlen($binary) > MAX_SCREENSHOT_BYTES) {
        respondJson(422, 'VALIDATION_FAILED', 'Screenshot is too large.');
    }

    $extension = $mime === 'image/jpeg' ? 'jpg' : 'png';
    $path = $tmpDir . '/pdf_' . $label . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
    if (file_put_contents($path, $binary, LOCK_EX) === false) {
        respondJson(500, 'TEMP_FILE_FAILED', 'Temporary image file could not be written.');
    }

    return ['path' => $path, 'mime' => $mime];
}

function enforceRateLimit(string $tmpDir): void
{
    $file = $tmpDir . '/rate-limit.json';
    $key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''));
    $now = time();

    $handle = fopen($file, 'c+');
    if ($handle === false) {
        return;
    }

    try {
        flock($handle, LOCK_EX);
        $contents = stream_get_contents($handle);
        $state = $contents !== false && trim($contents) !== '' ? json_decode($contents, true) : [];
        if (!is_array($state)) {
            $state = [];
        }

        foreach ($state as $stateKey => $entry) {
            $blockedUntil = (int)($entry['blockedUntil'] ?? 0);
            $hits = array_filter($entry['hits'] ?? [], static fn($hit) => (int)$hit >= $now - RATE_LIMIT_WINDOW_SECONDS);
            if ($blockedUntil < $now && count($hits) === 0) {
                unset($state[$stateKey]);
                continue;
            }
            $state[$stateKey]['hits'] = array_values($hits);
        }

        $entry = $state[$key] ?? ['blockedUntil' => 0, 'hits' => []];
        if ((int)$entry['blockedUntil'] > $now) {
            $retryAfter = (int)$entry['blockedUntil'] - $now;
            persistRateLimit($handle, $state);
            header('Retry-After: ' . $retryAfter);
            respondJson(429, 'RATE_LIMITED', 'Too many PDF requests. Please try again later.', ['retryAfter' => $retryAfter]);
        }

        $hits = array_values(array_filter($entry['hits'] ?? [], static fn($hit) => (int)$hit >= $now - RATE_LIMIT_WINDOW_SECONDS));
        if (count($hits) >= RATE_LIMIT_MAX_REQUESTS) {
            $entry['blockedUntil'] = $now + RATE_LIMIT_BLOCK_SECONDS;
            $entry['hits'] = $hits;
            $state[$key] = $entry;
            persistRateLimit($handle, $state);
            header('Retry-After: ' . RATE_LIMIT_BLOCK_SECONDS);
            respondJson(429, 'RATE_LIMITED', 'Too many PDF requests. Please try again later.', ['retryAfter' => RATE_LIMIT_BLOCK_SECONDS]);
        }

        $hits[] = $now;
        $entry['hits'] = $hits;
        $entry['blockedUntil'] = 0;
        $state[$key] = $entry;
        persistRateLimit($handle, $state);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function persistRateLimit($handle, array $state): void
{
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($state, JSON_PRETTY_PRINT));
    fflush($handle);
}

function ensureDirectory(string $path): void
{
    if (!is_dir($path)) {
        @mkdir($path, 0775, true);
    }
}

function sanitizeText(string $value): string
{
    $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $value = preg_replace('#<br\s*/?>#i', "\n", $value) ?? $value;
    $value = strip_tags($value);
    $value = preg_replace('/[ \t]+/', ' ', $value) ?? $value;
    $value = preg_replace("/\n{3,}/", "\n\n", $value) ?? $value;
    return trim($value);
}

function pdfText(string $value): string
{
    $converted = @iconv('UTF-8', 'windows-1252//TRANSLIT', $value);
    return $converted === false ? $value : $converted;
}

function sanitizeFilename(string $value): string
{
    $value = preg_replace('/[^A-Za-z0-9._-]/', '_', $value) ?? 'ringconf';
    return $value !== '' ? $value : 'ringconf';
}

function respondJson(int $status, string $code, string $message, array $extra = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => array_merge([
            'code' => $code,
            'message' => $message,
        ], $extra),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function logServerError(string $logDir, Throwable $exception): void
{
    $line = sprintf(
        "[%s] %s in %s:%d\n",
        date('c'),
        $exception->getMessage(),
        $exception->getFile(),
        $exception->getLine()
    );
    @file_put_contents($logDir . '/create.log', $line, FILE_APPEND | LOCK_EX);
}
