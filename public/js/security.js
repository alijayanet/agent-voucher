/**
 * Security Helper Functions
 * Provides XSS protection and input sanitization
 */

// XSS Protection: Escape HTML entities
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Safe innerHTML replacement
function safeSetInnerHTML(element, html) {
    if (!element) return;
    
    // Create temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove script tags and event handlers
    const scripts = temp.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
        scripts[i].remove();
    }
    
    // Remove all on* attributes (onclick, onload, etc.)
    const allElements = temp.getElementsByTagName('*');
    for (let elem of allElements) {
        const attributes = elem.attributes;
        for (let i = attributes.length - 1; i >= 0; i--) {
            const attr = attributes[i];
            if (attr.name.toLowerCase().startsWith('on')) {
                elem.removeAttribute(attr.name);
            }
        }
    }
    
    element.innerHTML = temp.innerHTML;
}

// Safe text content with HTML escaping
function safeSetTextContent(element, text) {
    if (!element) return;
    element.textContent = text;
}

// Validate input against XSS patterns
function validateInput(input) {
    if (typeof input !== 'string') return true;
    
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi,
        /<form/gi
    ];
    
    return !xssPatterns.some(pattern => pattern.test(input));
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.SecurityHelper = {
        escapeHtml,
        safeSetInnerHTML,
        safeSetTextContent,
        validateInput
    };
}
