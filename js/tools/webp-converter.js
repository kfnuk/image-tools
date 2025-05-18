// js/tools/webp-converter.js
function initWebPConverter() {
    console.log("WebP Converter Initialized");
    const dropZone = document.getElementById('webp-drop-zone');
    const fileInput = document.getElementById('webp-file-input');
    const fileListDisplay = document.getElementById('webp-file-list');
    const qualityInput = document.getElementById('webp-quality');
    const qualityValueDisplay = document.getElementById('webp-quality-value');
    const losslessCheckbox = document.getElementById('webp-lossless');
    const stripMetaCheckbox = document.getElementById('webp-strip-meta');
    const convertButton = document.getElementById('webp-convert-button');
    const loadingIndicator = document.getElementById('webp-loading');
    const downloadLinksContainer = document.getElementById('webp-download-links');

    let filesArray = []; // To store File objects

    if (!dropZone || !fileInput || !fileListDisplay || !qualityInput || !qualityValueDisplay || !losslessCheckbox || !stripMetaCheckbox || !convertButton || !loadingIndicator || !downloadLinksContainer) {
        console.error('WebP Converter: One or more essential DOM elements are missing.');
        if (window.showGlobalMessage) window.showGlobalMessage('WebP Converter UI elements missing. Tool may not work.', 'error');
        return;
    }

    // --- Event Listeners ---
    qualityInput.addEventListener('input', () => {
        qualityValueDisplay.textContent = qualityInput.value + '%';
    });

    losslessCheckbox.addEventListener('change', () => {
        qualityInput.disabled = losslessCheckbox.checked;
        qualityValueDisplay.textContent = losslessCheckbox.checked
            ? '100% (Lossless)'
            : qualityInput.value + '%';
        if (losslessCheckbox.checked) {
            qualityInput.value = 100; // Visually update slider though it's disabled
             qualityValueDisplay.textContent = '100% (Lossless)';
        }
    });

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('hover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('hover');
    });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('hover');
        addFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => addFiles(fileInput.files));
    convertButton.addEventListener('click', convertImages);

    // --- Functions ---
    function addFiles(newFiles) {
        for (const file of newFiles) {
            if (file.type.startsWith('image/')) {
                 // Check for duplicates by name and size to be more robust
                if (!filesArray.some(f => f.name === file.name && f.size === file.size)) {
                    filesArray.push(file);
                } else {
                    if (window.showGlobalMessage) window.showGlobalMessage(`Image "${file.name}" is already in the list.`, 'info', 3000);
                }
            } else {
                 if (window.showGlobalMessage) window.showGlobalMessage(`File "${file.name}" is not a supported image type.`, 'error', 3000);
            }
        }
        updateFileListDisplay();
        // Clear the input value to allow re-adding the same file if removed
        fileInput.value = '';
    }

    function removeFile(index) {
        filesArray.splice(index, 1);
        updateFileListDisplay();
    }

    function updateFileListDisplay() {
        fileListDisplay.innerHTML = ''; // Clear existing previews
        if (filesArray.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'text-center text-neutral-medium col-span-full'; // col-span-full for grid
            emptyMsg.textContent = 'No images selected yet.';
            fileListDisplay.appendChild(emptyMsg);
            return;
        }

        filesArray.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const card = document.createElement('div');
                card.className = 'preview-card';
                card.innerHTML = `
                    <button class="remove-btn" data-index="${index}" title="Remove ${file.name}">&times;</button>
                    <img src="${e.target.result}" alt="${file.name}">
                    <p>${file.name}</p>
                `;
                fileListDisplay.appendChild(card);
                // Add event listener to the newly created remove button
                card.querySelector('.remove-btn').addEventListener('click', function() {
                    removeFile(parseInt(this.dataset.index));
                });
            };
            reader.readAsDataURL(file);
        });
    }
    updateFileListDisplay(); // Initial call to show "No images" message

    async function convertImages() {
        downloadLinksContainer.innerHTML = ''; // Clear previous links
        if (!filesArray.length) {
            if (window.showGlobalMessage) window.showGlobalMessage('Please select or drop one or more image files.', 'info');
            return;
        }

        loadingIndicator.classList.remove('hidden');
        convertButton.disabled = true;

        const quality = losslessCheckbox.checked ? 1 : parseFloat(qualityInput.value) / 100;
        const conversionPromises = [];

        for (const file of filesArray) {
            const conversionPromise = new Promise((resolve, reject) => {
                const img = new Image();
                img.src = URL.createObjectURL(file);
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth; // Use naturalWidth/Height for original dimensions
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(img.src); // Revoke object URL after image is loaded

                    // Handle metadata stripping: redraw on a new canvas if checked
                    if (stripMetaCheckbox.checked) {
                        canvas.toBlob(blob => {
                            if (!blob) {
                                reject(new Error(`Failed to create blob for ${file.name}`));
                                return;
                            }
                            const tempImg = new Image();
                            tempImg.src = URL.createObjectURL(blob);
                            tempImg.onload = () => {
                                const tempCanvas = document.createElement('canvas');
                                tempCanvas.width = tempImg.naturalWidth;
                                tempCanvas.height = tempImg.naturalHeight;
                                const tempCtx = tempCanvas.getContext('2d');
                                tempCtx.drawImage(tempImg, 0, 0);
                                URL.revokeObjectURL(tempImg.src);
                                tempCanvas.toBlob(cleanBlob => {
                                    if (cleanBlob) {
                                        createDownloadLink(cleanBlob, file.name);
                                    } else {
                                         if (window.showGlobalMessage) window.showGlobalMessage(`Failed to process (strip meta) ${file.name}.`, 'error');
                                    }
                                    resolve();
                                }, 'image/webp', quality);
                            };
                            tempImg.onerror = () => {
                                reject(new Error(`Failed to load intermediate image for stripping metadata from ${file.name}`));
                            }
                        }, file.type); // Use original file type for intermediate blob
                    } else {
                        canvas.toBlob(blob => {
                            if (blob) {
                                createDownloadLink(blob, file.name);
                            } else {
                                if (window.showGlobalMessage) window.showGlobalMessage(`Failed to convert ${file.name}.`, 'error');
                            }
                            resolve();
                        }, 'image/webp', quality);
                    }
                };
                img.onerror = () => {
                    URL.revokeObjectURL(img.src);
                    if (window.showGlobalMessage) window.showGlobalMessage(`Could not load image: ${file.name}. It might be corrupted or an unsupported format.`, 'error');
                    reject(new Error(`Failed to load image ${file.name}`));
                };
            });
            conversionPromises.push(conversionPromise);
        }

        try {
            await Promise.all(conversionPromises);
            if (window.showGlobalMessage && downloadLinksContainer.children.length > 0) {
                window.showGlobalMessage('Conversion complete! Your downloads are ready.', 'success');
            } else if (downloadLinksContainer.children.length === 0) {
                window.showGlobalMessage('Conversion finished, but no files were processed successfully.', 'info');
            }
        } catch (error) {
            console.error("Error during batch conversion:", error);
            if (window.showGlobalMessage) window.showGlobalMessage('An error occurred during batch conversion. Some files may not have been processed.', 'error');
        } finally {
            loadingIndicator.classList.add('hidden');
            convertButton.disabled = false;
        }
    }

    function createDownloadLink(blob, originalName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName.substring(0, originalName.lastIndexOf('.')) + '.webp';
        a.className = 'download-btn btn btn-secondary'; // Use Tailwind classes + base btn
        a.innerHTML = `<i class="fas fa-download"></i> Download ${a.download}`;
        downloadLinksContainer.appendChild(a);
        // Consider revoking URL.createObjectURL(blob) after download or when tool is unloaded, but it can be tricky.
        // For simplicity, browsers will handle it on page close/navigation.
    }
}

// Make the init function available globally for main.js to call
window.currentToolInit = initWebPConverter;
