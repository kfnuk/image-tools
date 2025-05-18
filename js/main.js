// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const appContent = document.getElementById('app-content');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const currentYearSpan = document.getElementById('current-year');

    // --- Router ---
    const routes = {
        'webp-converter': {
            template: 'templates/webp-converter.html',
            script: 'js/tools/webp-converter.js',
            title: 'WebP Converter'
        },
        'remove-whitespace': {
            template: 'templates/remove-whitespace.html',
            script: 'js/tools/remove-whitespace.js',
            title: 'Remove Whitespace'
        },
        'crop-image': {
            template: 'templates/crop-image.html',
            script: 'js/tools/crop-image.js',
            title: 'Crop Image'
        },
        'image-resizer': { // New route for Image Resizer
            template: 'templates/image-resizer.html',
            script: 'js/tools/image-resizer.js', // Assuming your uploaded script.js will be moved here
            title: 'Image Resizer'
        }
    };

    // Function to load content based on hash
    async function loadContent() {
        const hash = window.location.hash.substring(1) || 'webp-converter';
        const route = routes[hash];

        // Remove any previously loaded external tool script
        const oldScript = document.getElementById('tool-specific-script');
        if (oldScript) {
            oldScript.remove();
        }
        window.currentToolInit = null;


        if (route) {
            try {
                appContent.innerHTML = '<div class="loading-spinner-container"><div class="spinner"></div></div>';
                const response = await fetch(route.template);
                if (!response.ok) throw new Error(`Failed to load template: ${route.template} - Status: ${response.status}`);
                const htmlString = await response.text();

                const range = document.createRange();
                const fragment = range.createContextualFragment(htmlString);
                const toolSectionElement = fragment.querySelector('.tool-section');

                appContent.innerHTML = '';
                if (toolSectionElement) {
                    appContent.appendChild(toolSectionElement);
                } else if (fragment.firstChild) {
                    console.warn(`[main.js] '.tool-section' not found directly. Appending fragment's children for ${route.title}.`);
                    while (fragment.firstChild) {
                        appContent.appendChild(fragment.firstChild);
                    }
                } else {
                    console.error(`[main.js] No content found in fetched template fragment for ${route.title}.`);
                    appContent.innerHTML = `<div class="text-center py-10 text-danger"><p>Error: Content for ${route.title} missing or malformed.</p></div>`;
                    throw new Error("Template's content was not found in fragment.");
                }

                document.title = `Image Tools Pro - ${route.title}`;

                // Only load external script if route.script is defined
                if (route.script) {
                    const scriptElement = document.createElement('script');
                    scriptElement.id = 'tool-specific-script';
                    scriptElement.src = route.script;
                    scriptElement.defer = true;

                    scriptElement.onload = () => {
                        setTimeout(() => {
                            if (typeof window.currentToolInit === 'function') {
                                window.currentToolInit();
                            } else {
                                console.warn(`No external init function (window.currentToolInit) for ${route.title}`);
                            }
                        }, 150);
                    };
                    scriptElement.onerror = () => {
                        console.error(`Failed to load script: ${route.script}`);
                        showGlobalMessage(`Error loading tool script for ${route.title}.`, 'error');
                    }
                    document.body.appendChild(scriptElement);
                }
                updateActiveLink(hash);
            } catch (error) {
                console.error('Error loading content:', error);
                appContent.innerHTML = `<div class="text-center py-10 text-danger"><p>Error loading tool: ${route.title}.</p></div>`;
                showGlobalMessage(`Failed to load ${route.title}: ${error.message}`, 'error');
            }
        } else {
            appContent.innerHTML = '<div class="text-center py-10"><p>Tool not found. Select a tool from the navigation.</p></div>';
            document.title = 'Image Tools Pro - Not Found';
            updateActiveLink('');
        }
    }

    function updateActiveLink(activeTool) {
        navLinks.forEach(link => {
            link.classList.toggle('active-link', link.dataset.tool === activeTool);
        });
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => { /* Handled by hashchange */ });
    });

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    window.showGlobalMessage = (message, type = 'info', duration = 5000) => {
        const container = document.getElementById('global-message-container');
        if (!container) return;
        const messageId = `msg-${Date.now()}`;
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `global-message ${type} opacity-0 translate-y-2`;
        const textSpan = document.createElement('span');
        textSpan.textContent = message;
        const closeButton = document.createElement('button');
        closeButton.className = 'close-message';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Close message');
        closeButton.onclick = () => {
            messageDiv.classList.add('opacity-0');
            setTimeout(() => messageDiv.remove(), 300);
        };
        messageDiv.appendChild(textSpan);
        messageDiv.appendChild(closeButton);
        container.appendChild(messageDiv);
        setTimeout(() => {
            messageDiv.classList.remove('opacity-0', 'translate-y-2');
            messageDiv.classList.add('opacity-100', 'translate-y-0');
        }, 10);
        if (duration) {
            setTimeout(() => {
                if (document.getElementById(messageId)) {
                    messageDiv.classList.add('opacity-0');
                    setTimeout(() => messageDiv.remove(), 300);
                }
            }, duration);
        }
    };

    window.addEventListener('hashchange', loadContent);
    loadContent();

    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
});