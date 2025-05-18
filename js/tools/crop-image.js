// js/tools/crop-image.js
function initCropImage() {
    console.log("Crop Image Tool Initialized");

    const dropZone = document.getElementById('crop-drop-zone');
    const fileInput = document.getElementById('crop-file-input');
    const canvas = document.getElementById('crop-canvas');
    const ctx = canvas.getContext('2d');
    const cropControlsPanel = document.getElementById('crop-controls-panel');
    const initialMessage = document.getElementById('crop-initial-message');

    const doCropBtn = document.getElementById('crop-do-crop-btn');
    const resetBtn = document.getElementById('crop-reset-btn');
    const downloadBtn = document.getElementById('crop-download-btn');
    const aspectRatioSelect = document.getElementById('crop-aspect-ratio');
    const lockAspectCheckbox = document.getElementById('crop-lock-aspect');
    const loadingIndicator = document.getElementById('crop-loading');

    // NEW: Define the primary accent color from Tailwind config (or hardcode if preferred for JS)
    // We'll use the hex directly here as JS can't easily read Tailwind config at runtime without more setup.
    const primaryAccentColor = '#0EA5E9'; // This should match 'primary' in tailwind.config

    if (!dropZone || !fileInput || !canvas || !cropControlsPanel || !doCropBtn || !resetBtn || !downloadBtn || !aspectRatioSelect || !lockAspectCheckbox || !loadingIndicator || !initialMessage) {
        console.error("Crop tool: One or more essential DOM elements are missing.");
        if (window.showGlobalMessage) window.showGlobalMessage("Crop tool UI elements missing. Tool may not function.", "error");
        return;
    }

    let originalImage = new Image();
    let currentImage = new Image();
    let cropX = 50, cropY = 50, cropW = 200, cropH = 200;
    let isDragging = false, isResizing = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    let activeHandle = null;
    let imageLoaded = false;
    let currentAspectRatioSetting = null;
    let dynamicAspectRatio = null;
    let originalDrawFunction = null;

    function showControls(show) {
        if (show) {
            cropControlsPanel.classList.remove('hidden');
            canvas.classList.remove('hidden');
            initialMessage.classList.add('hidden');
        } else {
            cropControlsPanel.classList.add('hidden');
            canvas.classList.add('hidden');
            initialMessage.classList.remove('hidden');
        }
    }
    showControls(false);

    const drawHandlesAndGrid = () => {
        ctx.strokeStyle = 'rgba(203, 213, 224, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        for (let i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(cropX + (cropW / 3) * i, cropY);
            ctx.lineTo(cropX + (cropW / 3) * i, cropY + cropH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cropX, cropY + (cropH / 3) * i);
            ctx.lineTo(cropX + cropW, cropY + (cropH / 3) * i);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.strokeStyle = primaryAccentColor; // Use new primary accent color
        ctx.lineWidth = 2;
        ctx.strokeRect(cropX, cropY, cropW, cropH);

        const handleSize = 8;
        const handles = [
            [cropX, cropY], [cropX + cropW / 2, cropY], [cropX + cropW, cropY],
            [cropX, cropY + cropH / 2], [cropX + cropW, cropY + cropH / 2],
            [cropX, cropY + cropH], [cropX + cropW / 2, cropY + cropH], [cropX + cropW, cropY + cropH]
        ];
        ctx.fillStyle = '#F3F4F6'; // neutral-lightest (Tailwind: theme.extend.colors.neutral-lightest)
        ctx.strokeStyle = primaryAccentColor; // Use new primary accent color
        handles.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, handleSize / 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        });
    };
    
    const drawCroppedImageOnly = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    };

    let draw = () => {
        if (!imageLoaded || !currentImage.src) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
        drawHandlesAndGrid();
        dynamicAspectRatio = cropW / cropH;
    };
    originalDrawFunction = draw;

    function getHandle(x, y) {
        const handleHitboxSize = 12;
        const handles = [
            [cropX, cropY], [cropX + cropW / 2, cropY], [cropX + cropW, cropY],
            [cropX, cropY + cropH / 2], [cropX + cropW, cropY + cropH / 2],
            [cropX, cropY + cropH], [cropX + cropW / 2, cropY + cropH], [cropX + cropW, cropY + cropH]
        ];
        return handles.findIndex(([hx, hy]) => Math.abs(hx - x) < handleHitboxSize && Math.abs(hy - y) < handleHitboxSize);
    }

    function updateCursor(e) {
        if (!imageLoaded) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const handle = getHandle(x,y);
        let cursorStyle = 'default';

        if (handle !== -1) {
            if (handle === 0 || handle === 7) cursorStyle = 'nwse-resize';
            else if (handle === 2 || handle === 5) cursorStyle = 'nesw-resize';
            else if (handle === 1 || handle === 6) cursorStyle = 'ns-resize';
            else if (handle === 3 || handle === 4) cursorStyle = 'ew-resize';
        } else if (x > cropX && x < cropX + cropW && y > cropY && y < cropY + cropH) {
            cursorStyle = 'move';
        }
        canvas.style.cursor = cursorStyle;
    }

    function handleMouseDown(e) {
        if (!imageLoaded) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const handle = getHandle(x, y);

        if (handle !== -1) {
            isResizing = true;
            activeHandle = handle;
            if (aspectRatioSelect.value === 'free' && lockAspectCheckbox.checked) {
                currentAspectRatioSetting = dynamicAspectRatio;
            }
        } else if (x > cropX && x < cropX + cropW && y > cropY && y < cropY + cropH) {
            isDragging = true;
            dragOffsetX = x - cropX;
            dragOffsetY = y - cropY;
        }
    }

    function handleMouseMove(e) {
        if (!imageLoaded) return;
        updateCursor(e);

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (isDragging) {
            cropX = Math.max(0, Math.min(canvas.width - cropW, mouseX - dragOffsetX));
            cropY = Math.max(0, Math.min(canvas.height - cropH, mouseY - dragOffsetY));
        } else if (isResizing) {
            const minSize = 20;
            let newCropX = cropX, newCropY = cropY, newCropW = cropW, newCropH = cropH;

            if (activeHandle === 0 || activeHandle === 3 || activeHandle === 5) {
                newCropW = cropW + (cropX - mouseX);
                newCropX = mouseX;
            }
            if (activeHandle === 2 || activeHandle === 4 || activeHandle === 7) {
                newCropW = mouseX - cropX;
            }
            if (activeHandle === 0 || activeHandle === 1 || activeHandle === 2) {
                newCropH = cropH + (cropY - mouseY);
                newCropY = mouseY;
            }
            if (activeHandle === 5 || activeHandle === 6 || activeHandle === 7) {
                newCropH = mouseY - cropY;
            }

            if (newCropW < minSize) {
                if (activeHandle === 0 || activeHandle === 3 || activeHandle === 5) newCropX = cropX + cropW - minSize;
                newCropW = minSize;
            }
            if (newCropH < minSize) {
                if (activeHandle === 0 || activeHandle === 1 || activeHandle === 2) newCropY = cropY + cropH - minSize;
                newCropH = minSize;
            }
            
            newCropX = Math.max(0, newCropX);
            newCropY = Math.max(0, newCropY);
            newCropW = Math.min(newCropW, canvas.width - newCropX);
            newCropH = Math.min(newCropH, canvas.height - newCropY);

            if (lockAspectCheckbox.checked && currentAspectRatioSetting) {
                if (activeHandle === 0 || activeHandle === 2 || activeHandle === 5 || activeHandle === 7) { 
                    const oldCenterX = cropX + cropW / 2;
                    const oldCenterY = cropY + cropH / 2;
                    
                    if (Math.abs(newCropW - cropW) > Math.abs(newCropH - cropH)) { 
                        newCropH = newCropW / currentAspectRatioSetting;
                    } else { 
                        newCropW = newCropH * currentAspectRatioSetting;
                    }
                    if(activeHandle === 0 || activeHandle === 5) newCropX = oldCenterX - newCropW / 2 + ( (mouseX - oldCenterX) > 0 ? (newCropW - cropW)/2 : -(newCropW - cropW)/2 );
                     else newCropX = oldCenterX - newCropW / 2 - ( (mouseX - oldCenterX) < 0 ? (newCropW - cropW)/2 : -(newCropW - cropW)/2 );

                    if(activeHandle === 0 || activeHandle === 2) newCropY = oldCenterY - newCropH / 2 + ( (mouseY - oldCenterY) > 0 ? (newCropH - cropH)/2 : -(newCropH - cropH)/2 );
                    else newCropY = oldCenterY - newCropH / 2 - ( (mouseY - oldCenterY) < 0 ? (newCropH - cropH)/2 : -(newCropH - cropH)/2 );
                } else if (activeHandle === 1 || activeHandle === 6) { 
                    newCropW = newCropH * currentAspectRatioSetting;
                    newCropX = cropX + (cropW - newCropW) / 2;
                } else if (activeHandle === 3 || activeHandle === 4) { 
                    newCropH = newCropW / currentAspectRatioSetting;
                    newCropY = cropY + (cropH - newCropH) / 2;
                }
                newCropX = Math.max(0, newCropX);
                newCropY = Math.max(0, newCropY);
                if (newCropX + newCropW > canvas.width) newCropW = canvas.width - newCropX;
                if (newCropY + newCropH > canvas.height) newCropH = canvas.height - newCropY;
                if (newCropW < minSize) { newCropW = minSize; newCropH = newCropW / currentAspectRatioSetting; }
                if (newCropH < minSize) { newCropH = minSize; newCropW = newCropH * currentAspectRatioSetting; }
            }
            cropX = newCropX; cropY = newCropY; cropW = newCropW; cropH = newCropH;
        }
        if (isDragging || isResizing) draw();
    }

    function handleMouseUp() {
        isDragging = false;
        isResizing = false;
    }

    function handleFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) {
            if (window.showGlobalMessage) window.showGlobalMessage('Please select a valid image file.', 'error');
            return;
        }
        loadingIndicator.classList.remove('hidden');
        showControls(false);

        const reader = new FileReader();
        reader.onload = e => {
            originalImage.onload = () => {
                const maxWidth = dropZone.offsetWidth; 
                const maxHeight = window.innerHeight * 0.6; 
                
                let displayWidth = originalImage.naturalWidth;
                let displayHeight = originalImage.naturalHeight;

                if (displayWidth > maxWidth) {
                    const ratio = maxWidth / displayWidth;
                    displayWidth = maxWidth;
                    displayHeight *= ratio;
                }
                if (displayHeight > maxHeight) {
                    const ratio = maxHeight / displayHeight;
                    displayHeight = maxHeight;
                    displayWidth *= ratio;
                }

                canvas.width = displayWidth;
                canvas.height = displayHeight;
                
                currentImage.src = originalImage.src; 
                currentImage.onload = () => { 
                    imageLoaded = true;
                    cropW = canvas.width * 0.6;
                    cropH = canvas.height * 0.6;
                    cropX = (canvas.width - cropW) / 2;
                    cropY = (canvas.height - cropH) / 2;
                    
                    draw = originalDrawFunction; 
                    applyAspectRatio(); 
                    draw();
                    
                    loadingIndicator.classList.add('hidden');
                    showControls(true);
                    downloadBtn.classList.add('hidden'); 
                    if (window.showGlobalMessage) window.showGlobalMessage(`Image "${file.name}" loaded.`, 'success', 2000);
                }
            };
            originalImage.onerror = () => {
                loadingIndicator.classList.add('hidden');
                if (window.showGlobalMessage) window.showGlobalMessage('Could not load the image data.', 'error');
            }
            originalImage.src = e.target.result;
        };
        reader.onerror = () => {
            loadingIndicator.classList.add('hidden');
            if (window.showGlobalMessage) window.showGlobalMessage('Failed to read the file.', 'error');
        }
        reader.readAsDataURL(file);
        fileInput.value = '';
    }

    function applyAspectRatio() {
        const val = aspectRatioSelect.value;
        if (val === 'free') {
            currentAspectRatioSetting = lockAspectCheckbox.checked ? (cropW / cropH) : null;
        } else if (val === 'original') {
            currentAspectRatioSetting = canvas.width / canvas.height;
        } else {
            const [w, h] = val.split(':').map(Number);
            currentAspectRatioSetting = w / h;
        }

        if (lockAspectCheckbox.checked && currentAspectRatioSetting) {
            const centerX = cropX + cropW / 2;
            const centerY = cropY + cropH / 2;
            let newCropW = cropW;
            let newCropH = cropH;

            newCropH = newCropW / currentAspectRatioSetting;

            if (newCropH > canvas.height || newCropH < 20) {
                 newCropH = Math.min(canvas.height, Math.max(20, newCropH));
                 newCropW = newCropH * currentAspectRatioSetting;
            }
             if (newCropW > canvas.width || newCropW < 20) {
                newCropW = Math.min(canvas.width, Math.max(20, newCropW));
                newCropH = newCropW / currentAspectRatioSetting;
            }

            cropX = Math.max(0, Math.min(centerX - newCropW / 2, canvas.width - newCropW));
            cropY = Math.max(0, Math.min(centerY - newCropH / 2, canvas.height - newCropH));
            cropW = Math.min(newCropW, canvas.width - cropX);
            cropH = Math.min(newCropH, canvas.height - cropY);
            draw();
        }
    }

    doCropBtn.addEventListener('click', () => {
        if (!imageLoaded || cropW <= 0 || cropH <= 0) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropW;
        tempCanvas.height = cropH;
        const tempCtx = tempCanvas.getContext('2d');

        const scaleX = originalImage.naturalWidth / canvas.width;
        const scaleY = originalImage.naturalHeight / canvas.height;

        const sourceX = cropX * scaleX;
        const sourceY = cropY * scaleY;
        const sourceWidth = cropW * scaleX;
        const sourceHeight = cropH * scaleY;
        
        tempCtx.drawImage(
            originalImage, 
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, cropW, cropH
        );

        currentImage.src = tempCanvas.toDataURL();
        currentImage.onload = () => {
            canvas.width = cropW;
            canvas.height = cropH;
            
            draw = drawCroppedImageOnly; 
            draw();
            
            downloadBtn.classList.remove('hidden');
            if (window.showGlobalMessage) window.showGlobalMessage('Image cropped! Ready to download.', 'success');
        }
    });

    resetBtn.addEventListener('click', () => {
        if (!originalImage.src) {
            showControls(false); 
            return;
        }
        
        // Create a dummy File object from the originalImage.src to re-trigger handleFileSelect
        // This is a bit of a workaround as we don't have the original File object directly
        fetch(originalImage.src)
            .then(res => res.blob())
            .then(blob => {
                const dummyFile = new File([blob], fileInput.files[0]?.name || "reset-image.png", { type: blob.type });
                handleFileSelect(dummyFile);
            });

        if (window.showGlobalMessage) window.showGlobalMessage('Crop reset to original image.', 'info', 2000);
    });
    
    downloadBtn.addEventListener('click', () => {
        if (!imageLoaded || !currentImage.src || draw === drawHandlesAndGrid) { 
             if (window.showGlobalMessage) window.showGlobalMessage('Please apply crop before downloading.', 'info');
            return;
        }
        const link = document.createElement('a');
        const fileNameBase = (fileInput.files[0]?.name.split('.')[0] || 'cropped_image');
        link.download = `${fileNameBase}_cropped.png`; 
        
        const qualityCanvas = document.createElement('canvas');
        
        let finalCropW, finalCropH;
        if (draw === drawCroppedImageOnly) { 
            finalCropW = currentImage.naturalWidth; 
            finalCropH = currentImage.naturalHeight;
            qualityCanvas.width = finalCropW;
            qualityCanvas.height = finalCropH;
            qualityCanvas.getContext('2d').drawImage(currentImage, 0, 0, finalCropW, finalCropH);

        } else { 
            const scaleX = originalImage.naturalWidth / canvas.width;
            const scaleY = originalImage.naturalHeight / canvas.height;
            finalCropW = cropW * scaleX;
            finalCropH = cropH * scaleY;
            qualityCanvas.width = finalCropW;
            qualityCanvas.height = finalCropH;
            qualityCanvas.getContext('2d').drawImage(
                originalImage,
                cropX * scaleX, cropY * scaleY, finalCropW, finalCropH,
                0, 0, finalCropW, finalCropH
            );
        }

        link.href = qualityCanvas.toDataURL('image/png'); 
        link.click();
        if (window.showGlobalMessage) window.showGlobalMessage('Download started.', 'success', 2000);
    });

    aspectRatioSelect.addEventListener('change', applyAspectRatio);
    lockAspectCheckbox.addEventListener('change', () => {
        if (lockAspectCheckbox.checked) {
            applyAspectRatio(); 
        } else {
            if (aspectRatioSelect.value === 'free') currentAspectRatioSetting = null;
        }
        if(imageLoaded) draw();
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => e.target.files.length && handleFileSelect(e.target.files[0]));
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('hover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('hover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('hover');
        if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    });

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp); 
    canvas.addEventListener('dblclick', () => { 
        if (imageLoaded && draw === originalDrawFunction) doCropBtn.click();
    });

    let lastTouchX = 0;
    let lastTouchY = 0;

    canvas.addEventListener('touchstart', e => {
        e.preventDefault(); 
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            handleMouseDown(touch); 
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            handleMouseMove(touch); 
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        handleMouseUp(); 
    }, { passive: false });
}

window.currentToolInit = initCropImage;
