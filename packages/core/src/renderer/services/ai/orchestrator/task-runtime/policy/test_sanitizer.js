const { PathSanitizer } = require('./PathSanitizer');

try {
    const safePath = PathSanitizer.sanitizePath('산출물.md', 'write', 'm1');
    console.log('SUCCESS:', safePath);
} catch (e) {
    console.error('ERROR:', e.message);
}
