// This function will be called by main.js after the template is loaded
window.currentToolInit = () => {
    // Get all necessary DOM elements. These IDs should match your image-resizer.html template.
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const resizeSelect = document.getElementById('resize-option');
    const customWidthInput = document.getElementById('custom-width');
    const customHeightInput = document.getElementById('custom-height');
    const qualityInput = document.getElementById('quality');
    const qualityValueDisplay = document.getElementById('quality-value');
    const filenameInput = document.getElementById('new-filename');
    const formatSelect = document.getElementById('format');
    const canvas = document.getElementById('preview-canvas'); // Ensure this ID exists in image-resizer.html
    const lockRatioCheckbox = document.getElementById('lock-ratio');
    const aspectRatioDisplay = document.getElementById('aspect-ratio');

    const percentageField = document.getElementById('percentage-field');
    const percentageValueInput = document.getElementById('percentage-value');
    const percentageDisplay = document.getElementById('percentage-display');
    const originalDimensionsDisplay = document.getElementById('original-dimensions');
    const newDimensionsDisplay = document.getElementById('new-dimensions');

    const editorInterface = document.getElementById('editor-interface');
    const previewContainer = document.getElementById('preview-container'); // Ensure this ID exists
    const spinner = document.getElementById('spinner'); // Ensure this ID exists
    const customSizeFields = document.getElementById('custom-size-fields');
    const processButton = document.getElementById('process-button');
    const notificationArea = document.getElementById('notification-area'); // Ensure this ID exists

    // Check if essential elements are found. If not, the tool can't initialize.
    if (!uploadArea || !fileInput || !resizeSelect || !canvas || !processButton || !editorInterface || !previewContainer) {
        console.error("Image Resizer: Essential HTML elements not found. Tool cannot initialize.");
        if (window.showGlobalMessage) { // Use global message if available
            window.showGlobalMessage("Error: Image Resizer UI elements missing. Please check the template.", "error", 10000);
        } else {
            alert("Error: Image Resizer UI elements missing. Tool cannot initialize.");
        }
        return; // Stop initialization
    }

    const ctx = canvas.getContext('2d');
    let originalImage = new Image();
    let currentImageAspectRatio = 1;
    let isProcessing = false;

    // --- Notification Function (specific to this tool) ---
    function showNotification(message, type = 'info', duration = 4000) {
        if (!notificationArea) {
            console.warn("Notification area not found for Image Resizer tool.");
            // Fallback to global message if the specific area isn't there
            if(window.showGlobalMessage) window.showGlobalMessage(message, type, duration);
            return;
        }
        const notification = document.createElement('div');
        // Using Tailwind classes directly for consistency if possible, or rely on CSS from main_css_updated
        notification.className = `notification ${type} bg-neutral-darker text-neutral-lightest p-3 rounded-md shadow-lg border-l-4 mb-2 opacity-0 transform translate-x-full transition-all duration-300 ease-out`;
        if (type === 'success') notification.classList.add('border-secondary');
        if (type === 'error') notification.classList.add('border-danger');
        if (type === 'info') notification.classList.add('border-primary');

        notification.textContent = message;
        notificationArea.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
          notification.style.opacity = '1';
          notification.style.transform = 'translateX(0)';
        }, 10);


        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) { // Check if still in DOM
                    notification.remove();
                }
            }, 300); // Allow fade out animation to complete
        }, duration);
    }

    // --- Event Listeners ---
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        // Using Tailwind classes for hover effect if preferred, or rely on CSS
        uploadArea.classList.add('border-primary', 'bg-neutral-dark');
    });

    uploadArea.addEventListener('dragleave', () => {
        // Remove Tailwind classes
        uploadArea.classList.remove('border-primary', 'bg-neutral-dark');
    });

    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.classList.remove('border-primary', 'bg-neutral-dark');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            handleFile(fileInput.files[0]);
        }
    });

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showNotification('Please upload a valid image file (e.g., JPG, PNG, WebP).', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            originalImage = new Image(); // Re-initialize to clear previous image data
            originalImage.onload = () => {
                currentImageAspectRatio = originalImage.width / originalImage.height;
                previewImageOnCanvas(); // This will also update dimensions in UI
                uploadArea.classList.add('hidden'); // Hide upload area
                editorInterface.classList.remove('hidden'); // Show controls and preview
                editorInterface.style.display = 'flex'; // Ensure it's flex if hidden by style
                previewContainer.classList.remove('hidden');
                canvas.classList.remove('hidden');
                updateUIForResizeOption(); // Call this to set initial control states
                processButton.disabled = false;
                showNotification('Image loaded successfully!', 'success', 2000);
            };
            originalImage.onerror = () => {
                showNotification('Could not load the image. It might be corrupted.', 'error');
                processButton.disabled = true;
            };
            originalImage.src = e.target.result;
        };
        reader.onerror = () => {
            showNotification('Error reading file.', 'error');
            processButton.disabled = true;
        };
        reader.readAsDataURL(file);
    }

    function previewImageOnCanvas() {
        if (!originalImage.src) return; // Don't draw if no image

        // Set canvas dimensions to the original image dimensions for initial preview
        // The actual resizing happens on a temporary canvas during processing
        const displayWidth = Math.min(originalImage.width, previewContainer.clientWidth - 40); // -40 for padding
        const displayHeight = displayWidth / currentImageAspectRatio;

        canvas.width = originalImage.width; // Keep canvas buffer at original size for quality
        canvas.height = originalImage.height;

        // Style canvas for display within the container
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';

        ctx.clearRect(0,0,canvas.width, canvas.height); // Clear previous image
        ctx.drawImage(originalImage, 0, 0);

        // Update UI elements that depend on original image dimensions
        if (resizeSelect.value === 'custom') {
            // Only set if they are empty, to preserve user input if they typed before image load
            if (!customWidthInput.value) customWidthInput.value = originalImage.width;
            if (!customHeightInput.value) customHeightInput.value = originalImage.height;
            updateAspectRatioText();
            if(aspectRatioDisplay) aspectRatioDisplay.classList.remove('hidden');
        } else if (resizeSelect.value === 'percentage') {
            if(originalDimensionsDisplay) originalDimensionsDisplay.textContent = `${originalImage.width}px × ${originalImage.height}px`;
            updatePercentagePreview();
            if(aspectRatioDisplay) aspectRatioDisplay.classList.add('hidden');
        } else if (resizeSelect.value !== 'original') {
            const [w, h] = resizeSelect.value.split('x').map(Number);
            if(customWidthInput) customWidthInput.value = w;
            if(customHeightInput) customHeightInput.value = h;
            if(aspectRatioDisplay) aspectRatioDisplay.classList.add('hidden');
        } else { // Original
            if(customWidthInput) customWidthInput.value = originalImage.width;
            if(customHeightInput) customHeightInput.value = originalImage.height;
            if(aspectRatioDisplay) aspectRatioDisplay.classList.add('hidden');
        }
    }

    resizeSelect.addEventListener('change', updateUIForResizeOption);

    function updateUIForResizeOption() {
        const option = resizeSelect.value;
        if(customSizeFields) customSizeFields.style.display = (option === 'custom' || (option !== 'percentage' && option !== 'original')) ? 'grid' : 'none'; // use grid as per HTML
        if(percentageField) percentageField.style.display = option === 'percentage' ? 'block' : 'none'; // use block or flex as per HTML

        if(customWidthInput) customWidthInput.readOnly = false;
        if(customHeightInput) customHeightInput.readOnly = false;
        if(aspectRatioDisplay) aspectRatioDisplay.classList.add('hidden');

        if (!originalImage.src) return;

        if (option === 'custom') {
            if(customWidthInput) customWidthInput.value = customWidthInput.value || originalImage.width;
            if(customHeightInput) customHeightInput.value = customHeightInput.value || originalImage.height;
            updateAspectRatioText();
            if (customWidthInput && customHeightInput && customWidthInput.value && customHeightInput.value) {
                 if(aspectRatioDisplay) aspectRatioDisplay.classList.remove('hidden');
            }
        } else if (option === 'percentage') {
            if(originalDimensionsDisplay) originalDimensionsDisplay.textContent = `${originalImage.width}px × ${originalImage.height}px`;
            if(percentageValueInput) percentageValueInput.value = 100;
            if(percentageDisplay) percentageDisplay.textContent = '100%';
            updatePercentagePreview();
        } else if (option === 'original') {
            if(customWidthInput) customWidthInput.value = originalImage.width;
            if(customHeightInput) customHeightInput.value = originalImage.height;
            if(customSizeFields) customSizeFields.style.display = 'grid'; // Show them for "original"
            if(customWidthInput) customWidthInput.readOnly = true;
            if(customHeightInput) customHeightInput.readOnly = true;
        } else { // Preset dimensions
            const [w, h] = option.split('x').map(Number);
            if(customWidthInput) customWidthInput.value = w;
            if(customHeightInput) customHeightInput.value = h;
            if(customWidthInput) customWidthInput.readOnly = true;
            if(customHeightInput) customHeightInput.readOnly = true;
        }
    }
    if(customWidthInput) {
        customWidthInput.addEventListener('input', () => {
            if (lockRatioCheckbox.checked && originalImage.src && !customWidthInput.readOnly) {
                const newWidth = parseInt(customWidthInput.value);
                if (!isNaN(newWidth) && newWidth > 0) {
                    customHeightInput.value = Math.round(newWidth / currentImageAspectRatio);
                } else if (newWidth <= 0) {
                     customHeightInput.value = '';
                }
            }
            updateAspectRatioText();
        });
    }

    if(customHeightInput) {
        customHeightInput.addEventListener('input', () => {
            if (lockRatioCheckbox.checked && originalImage.src && !customHeightInput.readOnly) {
                const newHeight = parseInt(customHeightInput.value);
                if (!isNaN(newHeight) && newHeight > 0) {
                    customWidthInput.value = Math.round(newHeight * currentImageAspectRatio);
                } else if (newHeight <= 0) {
                    customWidthInput.value = '';
                }
            }
            updateAspectRatioText();
        });
    }


    if(lockRatioCheckbox) {
        lockRatioCheckbox.addEventListener('change', () => {
            if (customWidthInput.value && originalImage.src && !customWidthInput.readOnly) {
                const newWidth = parseInt(customWidthInput.value);
                if (lockRatioCheckbox.checked && !isNaN(newWidth) && newWidth > 0) {
                    customHeightInput.value = Math.round(newWidth / currentImageAspectRatio);
                }
                updateAspectRatioText();
            } else if (customHeightInput.value && originalImage.src && !customHeightInput.readOnly && lockRatioCheckbox.checked) {
                const newHeight = parseInt(customHeightInput.value);
                 if (!isNaN(newHeight) && newHeight > 0) {
                    customWidthInput.value = Math.round(newHeight * currentImageAspectRatio);
                }
                updateAspectRatioText();
            }
        });
    }

    if(percentageValueInput) {
        percentageValueInput.addEventListener('input', () => {
            if(percentageDisplay) percentageDisplay.textContent = percentageValueInput.value + '%';
            updatePercentagePreview();
        });
    }


    function updatePercentagePreview() {
        if (!originalImage.src || !percentageValueInput || !newDimensionsDisplay) return;
        const percentage = parseInt(percentageValueInput.value) / 100;
        const newWidth = Math.round(originalImage.width * percentage);
        const newHeight = Math.round(originalImage.height * percentage);
        newDimensionsDisplay.textContent = `${Math.max(1,newWidth)}px × ${Math.max(1,newHeight)}px (approx)`;
    }

    if(qualityInput && qualityValueDisplay) {
        qualityInput.addEventListener('input', () => {
            qualityValueDisplay.textContent = qualityInput.value + '%';
        });
    }


    function updateAspectRatioText() {
        if (!customWidthInput || !customHeightInput || !aspectRatioDisplay) return;
        if (resizeSelect.value !== 'custom' || customWidthInput.readOnly) {
            aspectRatioDisplay.classList.add('hidden');
            return;
        }
        const w = parseInt(customWidthInput.value);
        const h = parseInt(customHeightInput.value);
        if (w && h && w > 0 && h > 0) {
            const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
            const ratioDivisor = gcd(w, h);
            aspectRatioDisplay.textContent = `Aspect Ratio: ${w/ratioDivisor}:${h/ratioDivisor}`;
            aspectRatioDisplay.classList.remove('hidden');
        } else {
            aspectRatioDisplay.textContent = 'Aspect Ratio: Invalid Dimensions';
            aspectRatioDisplay.classList.remove('hidden'); // Show invalid message
        }
    }

    processButton.addEventListener('click', () => {
        if (isProcessing) return;

        if (!originalImage.src) {
            showNotification('Please upload an image first.', 'error');
            return;
        }

        // Validate dimensions for custom mode
        if (resizeSelect.value === 'custom') {
            const w = parseInt(customWidthInput.value);
            const h = parseInt(customHeightInput.value);
            if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
                showNotification('Invalid custom dimensions. Width and height must be positive numbers.', 'error');
                return;
            }
        }


        isProcessing = true;
        if(spinner) spinner.style.display = 'block';
        processButton.disabled = true;
        processButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...'; // Using innerHTML to add icon

        setTimeout(() => { // Simulate processing delay for UX
            try {
                let targetWidth = originalImage.width;
                let targetHeight = originalImage.height;
                const option = resizeSelect.value;
                const format = formatSelect.value; // e.g., "image/jpeg"
                const quality = parseInt(qualityInput.value) / 100;

                if (option === 'percentage') {
                    const percentage = parseInt(percentageValueInput.value) / 100;
                    targetWidth = Math.round(originalImage.width * percentage);
                    targetHeight = Math.round(originalImage.height * percentage);
                } else if (option !== 'original') { // Custom or preset
                    if (option === 'custom') {
                        targetWidth = parseInt(customWidthInput.value); // Already validated
                        targetHeight = parseInt(customHeightInput.value); // Already validated
                    } else { // Preset
                        const [w, h] = option.split('x').map(Number);
                        targetWidth = w;
                        targetHeight = h;
                    }
                }

                targetWidth = Math.max(1, targetWidth); // Ensure positive dimensions
                targetHeight = Math.max(1, targetHeight);

                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = targetWidth;
                tempCanvas.height = targetHeight;
                tempCtx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);

                const baseFilename = (filenameInput.value.trim().replace(/[^a-z0-9_.-]/gi, '-') || 'resized-image');
                let extension = '.jpg'; // Default
                if (format === 'image/png') extension = '.png';
                else if (format === 'image/webp') extension = '.webp';

                const finalFilename = baseFilename + extension;

                tempCanvas.toBlob(blob => {
                    if (blob) {
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = finalFilename;
                        document.body.appendChild(link); // Required for Firefox
                        link.click();
                        document.body.removeChild(link); // Clean up
                        URL.revokeObjectURL(link.href); // Free up memory
                        showNotification('Image resized and download started!', 'success');
                    } else {
                        showNotification('Error creating image blob. The result might be too large or the format is not supported well by the browser.', 'error');
                    }
                    resetProcessingState();
                }, format, quality);

            } catch (error) {
                console.error("Error processing image:", error);
                showNotification('An unexpected error occurred during processing.', 'error');
                resetProcessingState();
            }
        }, 50); // Short delay before processing starts
    });

    function resetProcessingState() {
        if(spinner) spinner.style.display = 'none';
        processButton.disabled = !originalImage.src;
        processButton.innerHTML = '<i class="fas fa-cogs mr-2"></i>Optimise & Download';
        isProcessing = false;
    }

    // --- Initial UI Setup when tool loads ---
    updateUIForResizeOption(); // Set correct visibility of controls
    if(aspectRatioDisplay) aspectRatioDisplay.classList.add('hidden');
    processButton.disabled = true; // Initially disabled
    if(editorInterface) editorInterface.classList.add('hidden'); // Hide editor until image is loaded
    if(editorInterface) editorInterface.style.display = 'none';
    if(uploadArea) uploadArea.classList.remove('hidden'); // Ensure upload area is visible

    console.log("Image Resizer tool initialized.");
};
