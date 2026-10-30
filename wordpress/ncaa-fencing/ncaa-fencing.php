<?php
/**
 * Plugin Name: NCAA Fencing
 * Description: Embed the NCAA Fencing SPI and coaches poll application with [ncaa_fencing].
 * Version: 1.5.6
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

defined('ABSPATH') || exit;

function ncaa_fencing_can_view($post) {
    if (!$post || !has_shortcode($post->post_content, 'ncaa_fencing')) {
        return false;
    }
    if (post_password_required($post)) {
        return false;
    }
    return $post->post_status === 'publish'
        || ($post->post_status === 'private' && current_user_can('read_post', $post->ID));
}

add_action('template_redirect', function () {
    if (!isset($_GET['ncaa_fencing_app'])) {
        return;
    }
    $post = get_queried_object();
    if (!($post instanceof WP_Post) || !ncaa_fencing_can_view($post)) {
        status_header(403);
        nocache_headers();
        wp_die('This Fencing page is not available to your WordPress account.', 'Access required', array('response' => 403));
    }
    $file = plugin_dir_path(__FILE__) . 'entry.php';
    if (!is_readable($file)) {
        wp_die('The Fencing app build is missing. Reinstall the packaged plugin.', 'Missing build', array('response' => 503));
    }
    nocache_headers();
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Frame-Options: SAMEORIGIN');
    $base = plugins_url('app/', __FILE__);
    $html = substr(file_get_contents($file), strlen("<?php exit; ?>\n"));
    // Resolve Vite entry assets without changing the document base used by hash links.
    $html = str_replace(array('src="./', 'href="./'), array('src="' . esc_url($base), 'href="' . esc_url($base)), $html);
    $html = str_replace('href="/usfca-logo.png"', 'href="' . esc_url($base . 'usfca-logo.png') . '"', $html);
    $config = '<script>window.NCAA_FENCING_ASSET_BASE=' . wp_json_encode(rtrim($base, '/'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';</script>';
    $bridge = '<script src="' . esc_url(plugins_url('frame.js', __FILE__)) . '" defer></script>';
    $styles = '<link rel="stylesheet" href="' . esc_url(plugins_url('embedded.css', __FILE__)) . '?ver=1.5.6">';
    echo str_replace('</head>', $config . $bridge . $styles . '</head>', $html);
    exit;
}, 0);

add_shortcode('ncaa_fencing', function () {
    $post = get_post();
    if (!ncaa_fencing_can_view($post)) {
        return '';
    }
    wp_enqueue_script('ncaa-fencing-embed', plugins_url('embed.js', __FILE__), array(), '1.5.6', true);
    $src = add_query_arg('ncaa_fencing_app', '1', get_permalink($post));
    return '<iframe data-ncaa-fencing title="NCAA Fencing" src="' . esc_url($src) . '" style="display:block;width:100%;height:85vh;min-height:600px;border:0;background:#fff" allow="clipboard-write"></iframe>';
});
