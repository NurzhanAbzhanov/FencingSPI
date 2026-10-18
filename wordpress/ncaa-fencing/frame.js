(() => {
    if (parent === window) return;
    function publish() {
        if (/^#\/[a-z]/.test(location.hash)) {
            parent.postMessage({ type: 'ncaa-fencing-route', hash: location.hash }, location.origin);
        }
    }
    window.addEventListener('hashchange', publish);
    window.addEventListener('message', (event) => {
        if (event.origin !== location.origin || event.source !== parent) return;
        if (event.data?.type === 'ncaa-fencing-navigate' && /^#\/[a-z]/.test(event.data.hash)) {
            location.hash = event.data.hash;
        }
    });
    publish();
})();
