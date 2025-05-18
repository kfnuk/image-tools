// js/tools/remove-whitespace.js
function initRemoveWhitespace() {
    console.log("Remove Whitespace Initialized");
    const dropZone = document.getElementById('rws-drop-zone');
    const fileInput = document.getElementById('rws-file-input');
    const outputContainer = document.getElementById('rws-output');
    const loadingIndicator = document.getElementById('rws-loading');


    if (!dropZone || !fileInput || !outputContainer || !loadingIndicator) {
        console.error('Remove Whitespace: One or more essential DOM elements are missing.');
         if (window.showGlobalMessage) window.showGlobalMessage('Remove Whitespace UI elements missing. Tool may not work.', 'error');
        return;
    }
    let originalFileName = '';

    // --- Event Listeners ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('hover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('hover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('hover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        }
    });

    // --- Functions ---
    function handleFile(file) {
        if (!file) {
            if (window.showGlobalMessage) window.showGlobalMessage('No file selected.', 'info');
            return;
        }
        if (file.type !== 'image/png') {
            if (window.showGlobalMessage) window.showGlobalMessage('Please upload a PNG image. This tool specifically targets transparent areas in PNGs.', 'error');
            fileInput.value = ''; // Reset file input
            return;
        }

        originalFileName = file.name;
        outputContainer.innerHTML = ''; // Clear previous output
        loadingIndicator.classList.remove('hidden');


        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                try {
                    cropTransparentSpace(img);
                } catch (error) {
                    console.error("Error during image processing:", error);
                    if (window.showGlobalMessage) window.showGlobalMessage(`Error processing image: ${error.message}`, 'error');
                    outputContainer.innerHTML = `<p class="text-danger">An error occurred while processing the image.</p>`;
                } finally {
                    loadingIndicator.classList.add('hidden');
                }
            };
            img.onerror = () => {
                if (window.showGlobalMessage) window.showGlobalMessage('Could not load the image. It might be corrupted.', 'error');
                loadingIndicator.classList.add('hidden');
                outputContainer.innerHTML = `<p class="text-danger">Failed to load the selected image.</p>`;
            }
            img.src = e.target.result;
        };
        reader.onerror = () => {
            if (window.showGlobalMessage) window.showGlobalMessage('Error reading the file.', 'error');
            loadingIndicator.classList.add('hidden');
             outputContainer.innerHTML = `<p class="text-danger">Failed to read the selected file.</p>`;
        }
        reader.readAsDataURL(file);
        fileInput.value = ''; // Reset file input to allow re-uploading the same file
    }

    function cropTransparentSpace(image) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Important for performance with getImageData
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        ctx.drawImage(image, 0, 0);

        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
            // This can happen due to tainted canvas if image is from cross-origin and server doesn't allow
            console.error("Error getting ImageData: ", e);
            if (window.showGlobalMessage) window.showGlobalMessage('Could not process image: Canvas security error. Ensure image is from the same origin or has CORS headers.', 'error');
            outputContainer.innerHTML = `<p class="text-danger">Could not analyze image due to security restrictions (CORS).</p>`;
            return;
        }

        const pixels = imageData.data;
        let top = null, bottom = null, left = null, right = null;

        // Iterate through pixels to find bounds of non-transparent area
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                const alpha = pixels[idx + 3]; // Alpha channel
                if (alpha > 0) { // Consider any non-fully-transparent pixel as content
                    if (top === null) top = y;
                    if (bottom === null || y > bottom) bottom = y;
                    if (left === null || x < left) left = x;
                    if (right === null || x > right) right = x;
                }
            }
        }

        if (top === null) { // Image is completely transparent or empty
            if (window.showGlobalMessage) window.showGlobalMessage('The image appears to be completely transparent or empty. No cropping needed.', 'info');
            outputContainer.innerHTML = '<p class="text-neutral-medium">Image is fully transparent. No changes made.</p>';
            // Optionally, still show the original image
            const originalCanvas = document.createElement('canvas');
            originalCanvas.width = image.naturalWidth;
            originalCanvas.height = image.naturalHeight;
            originalCanvas.getContext('2d').drawImage(image, 0, 0);
            originalCanvas.classList.add('processed-image-canvas', 'mb-4');
            outputContainer.appendChild(originalCanvas);
            return;
        }
        // Ensure bottom and right are inclusive
        bottom = Math.min(bottom + 1, canvas.height);
        right = Math.min(right + 1, canvas.width);


        const trimmedWidth = right - left;
        const trimmedHeight = bottom - top;

        if (trimmedWidth <= 0 || trimmedHeight <= 0) {
             if (window.showGlobalMessage) window.showGlobalMessage('No significant content found to crop.', 'info');
             outputContainer.innerHTML = '<p class="text-neutral-medium">No significant content found to crop.</p>';
             return;
        }


        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = trimmedWidth;
        trimmedCanvas.height = trimmedHeight;
        trimmedCanvas.getContext('2d').drawImage(canvas, left, top, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
        trimmedCanvas.classList.add('processed-image-canvas', 'mb-4', 'shadow-lg');


        outputContainer.innerHTML = ''; // Clear previous content (like "Upload a PNG...")
        outputContainer.appendChild(trimmedCanvas);

        trimmedCanvas.toBlob(blob => {
            if (!blob) {
                if(window.showGlobalMessage) window.showGlobalMessage('Error creating blob for download.', 'error');
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const baseName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
            link.download = `${baseName}-trimmed.png`;
            link.className = 'btn btn-secondary mt-4'; // Tailwind + custom btn
            link.innerHTML = `<i class="fas fa-download mr-2"></i>Download Trimmed Image`;
            outputContainer.appendChild(link);
             if (window.showGlobalMessage) window.showGlobalMessage('Image trimmed successfully!', 'success');
        }, 'image/png');
    }
}

// Make the init function available globally for main.js to call
window.currentToolInit = initRemoveWhitespace;
