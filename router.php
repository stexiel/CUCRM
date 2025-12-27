<?php

// Маршрутизатор для встроенного PHP сервера
// Используется для поддержки .htaccess функциональности

$uri = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
$requested_file = __DIR__ . $uri;

// API рерайты согласно web.config
if (preg_match('/^\/api\/v1\/portal-access\/(.*)$/', $uri, $matches)) {
    $_SERVER['PHP_SELF'] = '/api/v1/portal-access/index.php';
    $_SERVER['SCRIPT_NAME'] = '/api/v1/portal-access/index.php';
    include __DIR__ . '/public/api/v1/portal-access/index.php';
    return;
}

if (preg_match('/^\/api\/v1\/(.*)$/', $uri, $matches)) {
    $_SERVER['PHP_SELF'] = '/api/v1/index.php';
    $_SERVER['SCRIPT_NAME'] = '/api/v1/index.php';
    include __DIR__ . '/public/api/v1/index.php';
    return;
}

if (preg_match('/^\/portal\/(.*)$/', $uri, $matches)) {
    $_SERVER['PHP_SELF'] = '/portal/index.php';
    $_SERVER['SCRIPT_NAME'] = '/portal/index.php';
    include __DIR__ . '/public/portal/index.php';
    return;
}

// Если это реальный файл (не директория), вернуть его
if (is_file($requested_file)) {
    return false;
}

// Иначе перенаправить на public/index.php
$_GET['_url'] = $uri;
include __DIR__ . '/public/index.php';

?>
