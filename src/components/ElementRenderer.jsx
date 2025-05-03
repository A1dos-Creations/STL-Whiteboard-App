import React, { useRef, useEffect, useState } from 'react';
import { Line, Text, Image as KonvaImage, Rect, Group } from 'react-konva';
import Konva from 'konva'; // Import Konva itself if needed for image loading

// Simple cache for image objects to avoid reloading
const imageCache = {};

const ElementRenderer = ({ element, isSelected, isEditing, onClick, onDoubleClick, onDragEnd, draggable }) => {
    const shapeRef = useRef();
    const [konvaImage, setKonvaImage] = useState(null);
    const [imageSize, setImageSize] = useState({ width: element.attrs.width || 150, height: element.attrs.height || 150 }); // Default/initial size

    // Handle Image Loading
    useEffect(() => {
        if (element.type === 'image' && element.attrs.src) {
            if (imageCache[element.attrs.src]) {
                setKonvaImage(imageCache[element.attrs.src]);
                // Use cached size if available, otherwise element attrs
                setImageSize({
                    width: imageCache[element.attrs.src].naturalWidth || element.attrs.width || 150,
                    height: imageCache[element.attrs.src].naturalHeight || element.attrs.height || 150
                 });
            } else {
                const img = new window.Image();
                img.src = element.attrs.src;
                img.onload = () => {
                    imageCache[element.attrs.src] = img; // Cache it
                    setKonvaImage(img);
                     // Update size based on loaded image, respecting aspect ratio if only one dimension was set
                     const aspectRatio = img.naturalWidth / img.naturalHeight;
                     let targetWidth = element.attrs.width || img.naturalWidth;
                     let targetHeight = element.attrs.height || img.naturalHeight;

                     // If only width or height was provided, calculate the other based on aspect ratio
                     if (element.attrs.width && !element.attrs.height) {
                         targetHeight = targetWidth / aspectRatio;
                     } else if (!element.attrs.width && element.attrs.height) {
                         targetWidth = targetHeight * aspectRatio;
                     } else if (!element.attrs.width && !element.attrs.height) {
                        // If neither was provided, use natural size (or a default max)
                         targetWidth = Math.min(img.naturalWidth, 500); // Example max default width
                         targetHeight = targetWidth / aspectRatio;
                     }
                     // Use Math.max to prevent zero dimensions
                     setImageSize({ width: Math.max(10, targetWidth), height: Math.max(10, targetHeight) });
                };
                img.onerror = () => {
                    console.error(`Failed to load image: ${element.attrs.src}`);
                    // Optionally set a placeholder image or state
                }
            }
        }
    }, [element.type, element.attrs.src, element.attrs.width, element.attrs.height]); // Add width/height deps

     // Define common props
     const commonProps = {
        id: element.id, // IMPORTANT: Set Konva node ID to match element ID for selection/transformer
        ref: shapeRef,
        draggable: draggable,
        onClick: (e) => onClick(e, element), // Pass element data to handler
        onTap: (e) => onClick(e, element), // Handle tap on touch devices
        onDblClick: (e) => onDoubleClick(e, element),
        onDblTap: (e) => onDoubleClick(e, element),
        onDragEnd: (e) => onDragEnd(e, element), // Pass element data
        // Add other event handlers as needed (onDragStart, onDragMove, onTransform, etc.)
        // Opacity to hide the original while editing text inline
        opacity: isEditing ? 0 : 1,
    };

    switch (element.type) {
        case 'line':
            return <Line {...element.attrs} {...commonProps} />;
        case 'text':
            return <Text {...element.attrs} {...commonProps} />;
        case 'sticky':
             // Use a Group to combine Rect and Text for the sticky note
             return (
                 <Group {...commonProps} x={element.attrs.x} y={element.attrs.y} width={element.attrs.width} height={element.attrs.height} >
                     <Rect
                         width={element.attrs.width}
                         height={element.attrs.height}
                         fill={element.attrs.fill || '#FFFFAA'}
                         shadowBlur={5}
                         shadowOffsetX={2}
                         shadowOffsetY={2}
                         shadowOpacity={0.3}
                         cornerRadius={element.attrs.cornerRadius || 4} // Allow customization
                     />
                     <Text
                         text={element.attrs.text}
                         fontSize={element.attrs.fontSize || 16}
                         fontFamily={element.attrs.fontFamily || 'Arial, sans-serif'}
                         fill={element.attrs.textColor || '#000000'} // Allow custom text color
                         width={element.attrs.width - (element.attrs.padding || 10) * 2} // Adjust width for padding
                         height={element.attrs.height - (element.attrs.padding || 10) * 2}// Adjust height for padding
                         padding={element.attrs.padding || 10}
                         align={element.attrs.align || 'left'}
                         verticalAlign={element.attrs.verticalAlign || 'top'}
                         // Prevent text itself from being individually draggable within the group
                         draggable={false}
                         // Clicks/double-clicks on Text should bubble up to the Group handler
                     />
                 </Group>
             );
        case 'image':
            // Render only when Konva image object is loaded
            return konvaImage ? (
                <KonvaImage
                    image={konvaImage}
                    {...element.attrs} // Spread other attributes like x, y, rotation
                    width={imageSize.width} // Use state for size
                    height={imageSize.height} // Use state for size
                    {...commonProps}
                />
            ) : null; // Render nothing until image loads
        default:
            console.warn(`Unknown element type: ${element.type}`);
            return null;
    }
};

export default ElementRenderer;