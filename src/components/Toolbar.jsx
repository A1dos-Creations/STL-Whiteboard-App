import React, { useRef } from 'react';
import '../styles/Toolbar.css';

function Toolbar({
    selectedTool,
    onToolSelect,
    drawOptions,
    onDrawOptionsChange,
    onImageAdd,
    canAddImage
}) {
    const fileInputRef = useRef(null);

    const handleColorChange = (e) => {
        onDrawOptionsChange({ ...drawOptions, stroke: e.target.value });
    };

    const handleWidthChange = (e) => {
        const newWidth = parseInt(e.target.value, 10);
        if (!isNaN(newWidth) && newWidth > 0) {
            onDrawOptionsChange({ ...drawOptions, strokeWidth: newWidth });
        }
    };

    const handleImageButtonClick = () => {
        if (canAddImage) {
            fileInputRef.current?.click();
        } else {
            alert("Image limit reached for this session.");
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onImageAdd(reader.result); // Send base64 data URL
            };
            reader.readAsDataURL(file);
        }
        // Reset file input value so the same file can be selected again if needed
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const tools = ['select', 'draw', 'text', 'sticky']; // Image is separate button

    return (
        <div className="toolbar">
            <div className="tool-section tools">
                {tools.map(tool => (
                    <button
                        key={tool}
                        className={`tool-button ${selectedTool === tool ? 'active' : ''}`}
                        onClick={() => onToolSelect(tool)}
                        title={tool.charAt(0).toUpperCase() + tool.slice(1)}
                    >
                        {/* You can replace text with icons */}
                        {tool.charAt(0).toUpperCase() + tool.slice(1)}
                    </button>
                ))}
                 <button
                    className="tool-button"
                    onClick={handleImageButtonClick}
                    title="Add Image"
                    disabled={!canAddImage}
                >
                    Image {canAddImage ? '' : '(Limit Reached)'}
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>

            {selectedTool === 'draw' && (
                <div className="tool-section options draw-options">
                    <label htmlFor="strokeColor">Color:</label>
                    <input
                        type="color"
                        id="strokeColor"
                        value={drawOptions.stroke}
                        onChange={handleColorChange}
                        title="Drawing Color"
                    />
                    <label htmlFor="strokeWidth">Width:</label>
                    <input
                        type="number"
                        id="strokeWidth"
                        min="1"
                        max="50"
                        value={drawOptions.strokeWidth}
                        onChange={handleWidthChange}
                        title="Drawing Stroke Width"
                    />
                </div>
            )}

             {/* Add options for Text/Sticky tool if needed (e.g., font size, color) */}
             {/* {selectedTool === 'text' && (...)} */}

        </div>
    );
}

export default Toolbar;