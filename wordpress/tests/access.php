<?php
define('ABSPATH', __DIR__);
function add_action(...$args) {}
function add_shortcode(...$args) {}
function has_shortcode($content, $name) { return strpos($content, '[' . $name . ']') !== false; }
function post_password_required($post) { return $post->password; }
function current_user_can(...$args) { return $GLOBALS['can_read']; }
require __DIR__ . '/../ncaa-fencing/ncaa-fencing.php';

function check_access($status, $can_read, $password, $shortcode, $expected) {
    $GLOBALS['can_read'] = $can_read;
    $post = (object) array('ID'=>1, 'post_status'=>$status, 'password'=>$password,
        'post_content'=>$shortcode ? '[ncaa_fencing]' : 'Ordinary page');
    if (ncaa_fencing_can_view($post) !== $expected) {
        throw new Exception('Access check failed: ' . $status);
    }
}
check_access('private', false, false, true, false);
check_access('private', true, false, true, true);
check_access('publish', false, false, true, true);
check_access('publish', true, true, true, false);
check_access('draft', true, false, true, false);
check_access('trash', true, false, true, false);
check_access('publish', true, false, false, false);
echo "Seven WordPress access checks passed.\n";
