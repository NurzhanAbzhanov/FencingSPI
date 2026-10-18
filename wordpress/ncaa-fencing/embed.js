(() => {
    const frame = document.querySelector('iframe[data-ncaa-fencing]');
    if (!frame) return;
    if (location.hash) frame.src = frame.src.split('#')[0] + location.hash;
    window.addEventListener('message', (event) => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
        if (event.data?.type === 'ncaa-fencing-route' && /^#\/[a-z]/.test(event.data.hash)) {
            history.replaceState(null, '', location.pathname + location.search + event.data.hash);
        }
    });
    window.addEventListener('hashchange', () => {
        frame.contentWindow.postMessage({ type: 'ncaa-fencing-navigate', hash: location.hash }, location.origin);
    });
})();
