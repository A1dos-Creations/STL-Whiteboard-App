import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import ElementRenderer from './ElementRenderer';
import { generateUniqueId } from '../utils/helpers';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const SCROLL_SENSITIVITY = 0.001;

function WhiteboardCanvas({ elements, onCanvasChange, selectedTool, drawOptions }) {
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const trRef = useRef(null); // Transformer ref
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState(null); // For freehand drawing
  const [isPanning, setIsPanning] = useState(false);
  const [panStartCoords, setPanStartCoords] = useState({ x: 0, y: 0 });
  const isMiddleOrRightButtonDown = useRef(false);
  const [editingElementId, setEditingElementId] = useState(null); // ID of element being text-edited

  // --- Zooming ---
  const handleWheel = (e) => {
    e.evt.preventDefault(); // Prevent page scrolling
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return; // Exit if pointer is somehow null

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // Determine new scale direction
    let direction = e.evt.deltaY > 0 ? -1 : 1; // -1 for zoom out, 1 for zoom in

    // Adjust scale sensitivity
    const scaleBy = 1 + Math.abs(e.evt.deltaY) * SCROLL_SENSITIVITY * direction;

    let newScale = oldScale * scaleBy;
    newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale)); // Clamp zoom level

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw(); // Redraw stage efficiently
  };

  // --- Panning ---
  const handleMouseDownPan = useCallback((e) => {
    // Middle mouse button (button 1) or Right mouse button (button 2)
    if (e.evt.button === 1 || e.evt.button === 2) {
        e.evt.preventDefault(); // Prevent context menu on right click
        setIsPanning(true);
        isMiddleOrRightButtonDown.current = true;
        setPanStartCoords({ x: e.evt.clientX, y: e.evt.clientY });
        const stage = stageRef.current;
        if (stage) stage.container().style.cursor = 'grabbing';
    }
  }, []);

  const handleMouseMovePan = useCallback((e) => {
     if (!isPanning || !isMiddleOrRightButtonDown.current) return;
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const dx = e.evt.clientX - panStartCoords.x;
      const dy = e.evt.clientY - panStartCoords.y;

      stage.move({ x: dx, y: dy });
      setPanStartCoords({ x: e.evt.clientX, y: e.evt.clientY }); // Update start for next move delta
      stage.batchDraw();
  }, [isPanning, panStartCoords]);

   const handleMouseUpPan = useCallback((e) => {
       // Check specifically if it was the middle or right button that was released
       if (e.evt.button === 1 || e.evt.button === 2) {
            setIsPanning(false);
            isMiddleOrRightButtonDown.current = false;
            const stage = stageRef.current;
            if (stage) stage.container().style.cursor = 'default'; // Reset cursor
       }
       // Also handle general mouse up to reset panning state if needed
       if (isPanning) {
           setIsPanning(false);
           const stage = stageRef.current;
            if (stage) stage.container().style.cursor = 'default'; // Reset cursor
       }
   }, [isPanning]);

   // Attach pan listeners globally to handle mouse leaving canvas during pan
   useEffect(() => {
        // Don't attach if server-side rendering
       if (typeof window === 'undefined') return;

       window.addEventListener('mousemove', handleMouseMovePan);
       window.addEventListener('mouseup', handleMouseUpPan);

       return () => {
           window.removeEventListener('mousemove', handleMouseMovePan);
           window.removeEventListener('mouseup', handleMouseUpPan);
           // Reset cursor if component unmounts while panning
           const stage = stageRef.current;
           if (stage && stage.container()) {
                stage.container().style.cursor = 'default';
           }
       };
   }, [handleMouseMovePan, handleMouseUpPan]);

   // --- Element Interaction ---
   const handleStageMouseDown = (e) => {
        handleMouseDownPan(e); // Check for panning start

        // If not panning, proceed with other interactions
        if (isMiddleOrRightButtonDown.current) return;

        // 1. Handle Clicking Off Element (Deselect)
        const clickedOnEmpty = e.target === e.target.getStage() || e.target.hasName('background-rect'); // Assume a background rect or check target type
        if (clickedOnEmpty) {
            setSelectedElementId(null);
            trRef.current?.nodes([]); // Clear transformer
            setEditingElementId(null); // Stop text editing
            return;
        }

        // 2. Handle Tool Actions (Drawing, Text, Sticky)
        const stage = stageRef.current;
        const pos = stage.getRelativePointerPosition();

        if (selectedTool === 'draw') {
            setIsDrawing(true);
            setCurrentLine({
                id: generateUniqueId(),
                type: 'line', // Or 'drawing', 'path'
                attrs: {
                    points: [pos.x, pos.y, pos.x, pos.y], // Start with a tiny line
                    stroke: drawOptions.stroke,
                    strokeWidth: drawOptions.strokeWidth,
                    lineCap: 'round',
                    lineJoin: 'round',
                    tension: 0.5, // Optional smoothing
                    isDraggable: false, // Drawings usually aren't draggable by default
                }
            });
        } else if (selectedTool === 'text') {
            // Create text element on click (initially empty or with placeholder)
            const newText = {
                id: generateUniqueId(),
                type: 'text',
                attrs: {
                    x: pos.x,
                    y: pos.y,
                    text: 'Double-click to edit',
                    fontSize: 20,
                    fill: drawOptions.stroke, // Use draw color for text initially
                    isDraggable: true,
                }
            };
            onCanvasChange('element_add', newText);
            // Automatically select and maybe trigger edit? Or wait for dblclick.
            setSelectedElementId(newText.id);
            trRef.current?.nodes([e.target.getStage().findOne(`#${newText.id}`)]); // Select requires finding the Konva node
            // setEditingElementId(newText.id); // Optionally start editing immediately
        } else if (selectedTool === 'sticky') {
           const newSticky = {
                id: generateUniqueId(),
                type: 'sticky',
                attrs: {
                    x: pos.x,
                    y: pos.y,
                    text: 'Sticky Note\nDouble-click...',
                    fill: '#FFFFAA', // Default sticky color
                    width: 150,
                    height: 100,
                    padding: 10,
                    fontSize: 16,
                    isDraggable: true,
                }
            };
            onCanvasChange('element_add', newSticky);
            setSelectedElementId(newSticky.id);
            trRef.current?.nodes([e.target.getStage().findOne(`#${newSticky.id}`)]); // Select requires finding the Konva node
        }
   };

    const handleStageMouseMove = (e) => {
        // Don't draw if panning or not using draw tool
        if (!isDrawing || selectedTool !== 'draw' || isMiddleOrRightButtonDown.current) return;

        const stage = stageRef.current;
        const pos = stage.getRelativePointerPosition();
        if (!pos) return;

        setCurrentLine(prevLine => {
            if (!prevLine) return null;
            // Create a new object to ensure React detects the change
            const updatedLine = { ...prevLine };
            updatedLine.attrs = { ...prevLine.attrs };
            updatedLine.attrs.points = prevLine.attrs.points.concat([pos.x, pos.y]);
            return updatedLine;
        });
    };

    const handleStageMouseUp = (e) => {
       handleMouseUpPan(e); // Check for panning end

       if (isDrawing && selectedTool === 'draw' && currentLine) {
           setIsDrawing(false);
           // Prevent sending tiny dots on click without drag
           if (currentLine.attrs.points.length > 4) {
               onCanvasChange('element_add', currentLine);
           }
           setCurrentLine(null); // Clear the temporary line
       }
   };

   // Handle clicking ON an element (Select)
   const handleElementClick = (e, element) => {
        // Prevent selection change if panning starts on an element
        if (isMiddleOrRightButtonDown.current) return;

       if (selectedTool === 'select') {
            setSelectedElementId(element.id);
            // Update transformer
            // Need to find the actual Konva node using its ID
            const node = stageRef.current?.findOne(`#${element.id}`);
            if (node && trRef.current) {
                 trRef.current.nodes([node]);
                 trRef.current.getLayer().batchDraw(); // Redraw transformer layer
            } else {
                trRef.current?.nodes([]); // Clear if node not found
            }
        }
       // Potentially handle delete tool here too
   };

   // Handle dragging an element
   const handleDragEnd = (e, element) => {
        const node = e.target;
        const newAttrs = {
            x: node.x(),
            y: node.y(),
        };
        // Send update for the moved element
        onCanvasChange('element_update', { id: element.id, attrs: newAttrs });
   };

    // Handle transforming an element (resize/rotate)
    const handleTransformEnd = (e) => {
        const node = e.target; // The node being transformed
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const rotation = node.rotation();

        // Important: Reset scale and apply it to width/height directly
        // to avoid scale compounding issues
        node.scaleX(1);
        node.scaleY(1);

        const newAttrs = {
            x: node.x(),
            y: node.y(),
            // Apply scale to dimensions
            width: Math.max(5, node.width() * scaleX), // Use Math.max to prevent zero/negative sizes
            height: Math.max(5, node.height() * scaleY),
            rotation: rotation,
            // Potentially update other attributes like cornerRadius if scaling affects them
        };

        onCanvasChange('element_update', { id: node.id(), attrs: newAttrs });
    };

    // Handle double-click for editing text/sticky
    const handleDoubleClick = (e, element) => {
       if (element.type === 'text' || element.type === 'sticky') {
           setSelectedElementId(element.id); // Ensure it's selected
           setEditingElementId(element.id); // Enter editing mode
            // Position the textarea editor (logic below)
       }
       // Also deselect text in browser if double clicking selects words
        window.getSelection()?.removeAllRanges();
   };

   // --- Text Area Editing ---
   const textAreaRef = useRef(null);

   useEffect(() => {
       if (editingElementId && textAreaRef.current) {
            textAreaRef.current.focus();
       }
   }, [editingElementId]);

   const handleTextEdit = (e) => {
        const updatedText = e.target.value;
        const elementToUpdate = elements.find(el => el.id === editingElementId);
        if (!elementToUpdate) return;

        // Local temporary update for smoother editing (optional)
        // This requires modifying the element directly in the stage if possible,
        // or triggering a state update which might be slow.
        // For simplicity, we update only on blur/enter.

        // Update via backend on blur or enter
        const newAttrs = { text: updatedText };
        onCanvasChange('element_update', { id: editingElementId, attrs: newAttrs });

        // Optionally update element size based on text content for stickies
        // This requires calculating text dimensions, which can be complex.
   };

   const handleTextEditBlur = (e) => {
        handleTextEdit(e); // Save current text
        setEditingElementId(null); // Exit editing mode
   };

    const handleTextEditKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Allow Shift+Enter for newlines
            e.preventDefault(); // Prevent default newline in textarea
            handleTextEdit(e); // Save
            setEditingElementId(null); // Exit editing mode
        } else if (e.key === 'Escape') {
            setEditingElementId(null); // Exit editing mode without saving recent changes (or revert?)
        }
    };

    // Calculate textarea position
    const getTextAreaPosition = () => {
        const stage = stageRef.current;
        const textNode = stage?.findOne(`#${editingElementId}`);
        if (!textNode || !stage) return { display: 'none' };

        const textPosition = textNode.getAbsolutePosition();
        const stageBox = stage.container().getBoundingClientRect();
        const areaPosition = {
            x: stageBox.left + textPosition.x,
            y: stageBox.top + textPosition.y,
        };

        const rotation = textNode.rotation() || 0; // Handle potential rotation
        const scale = stage.scaleX(); // Account for stage zoom

        return {
            display: 'block',
            position: 'absolute',
            top: `${areaPosition.y}px`,
            left: `${areaPosition.x}px`,
            width: `${textNode.width() * scale}px`,
            height: `${textNode.height() * scale}px`,
            fontSize: `${(textNode.fontSize() || 16) * scale}px`, // Adjust font size with zoom
            lineHeight: textNode.lineHeight() || 1.2, // Match Konva's line height
            fontFamily: textNode.fontFamily() || 'sans-serif',
            textAlign: textNode.align() || 'left',
            color: textNode.fill() || '#000000',
            transformOrigin: '0 0',
            transform: `rotate(${rotation}deg)`,
            padding: `${(textNode.padding ? textNode.padding() : 0) * scale}px`, // Adjust padding
            overflow: 'hidden', // Hide overflow
            background: elementBeingEdited?.type === 'sticky' ? (elementBeingEdited.attrs.fill || '#FFFFAA') : 'none', // Match background
            border: '1px dashed grey', // Indicate editing
            resize: 'none', // Disable manual resize
            zIndex: 1000, // Ensure textarea is on top
        };
    };

     const elementBeingEdited = elements.find(el => el.id === editingElementId);

   // --- Rendering ---
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Stage
        ref={stageRef}
        width={window.innerWidth} // Adjust as needed, perhaps based on container size
        height={window.innerHeight - 60} // Adjust based on toolbar/statusbar height
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onContextMenu={(e) => e.evt.preventDefault()} // Prevent context menu globally on stage
        className="whiteboard-stage" // For CSS targeting (e.g., cursor)
      >
        <Layer>
          {/* Optional Background Rect for Dot Grid or Clicks */}
           <Rect
                x={0} y={0}
                width={5000} height={5000} // Large background area
                fill="#FFFFFF" // White background
                name="background-rect" // Name to identify clicks on background
                // To place it behind everything, ensure it's first or manage z-index
            />
        </Layer>
        <Layer ref={layerRef}>
            {/* Render user elements */}
            {elements.map((element) => (
                <ElementRenderer
                    key={element.id}
                    element={element}
                    isSelected={element.id === selectedElementId}
                    isEditing={element.id === editingElementId}
                    onClick={(e) => handleElementClick(e, element)}
                    onDoubleClick={(e) => handleDoubleClick(e, element)}
                    onDragEnd={(e) => handleDragEnd(e, element)}
                    onTransformEnd={handleTransformEnd} // Pass transformer handler down if needed by ElementRenderer
                    draggable={selectedTool === 'select' && element.attrs.isDraggable !== false} // Only draggable with select tool
                />
            ))}
            {/* Render the line currently being drawn */}
            {currentLine && (
                 <ElementRenderer
                    element={currentLine}
                    isSelected={false}
                    isEditing={false}
                    draggable={false}
                />
            )}
             {/* Transformer for selected element */}
             <Transformer
                ref={trRef}
                boundBoxFunc={(oldBox, newBox) => {
                    // Limit resize dimensions if needed
                    if (newBox.width < 5 || newBox.height < 5) {
                        return oldBox;
                    }
                    return newBox;
                }}
                // Optionally customize transformer appearance
                 borderStroke="#007AFF"
                 anchorStroke="#007AFF"
                 anchorFill="#FFFFFF"
                 anchorSize={8}
                 rotateEnabled={true} // Enable rotation
                 keepRatio={false} // Allow free resizing by default
                 onTransformEnd={handleTransformEnd} // Handle transform end directly on Transformer
            />
        </Layer>
      </Stage>
      {/* Textarea for inline editing */}
        {editingElementId && elementBeingEdited && (
             <textarea
                ref={textAreaRef}
                style={getTextAreaPosition()}
                defaultValue={elementBeingEdited.attrs.text} // Use defaultValue for uncontrolled component behavior during typing
                onBlur={handleTextEditBlur}
                onKeyDown={handleTextEditKeyDown}
                // onChange={handleTextEdit} // Use onChange for real-time preview (more complex state mgmt needed)
            />
        )}
    </div>
  );
}

export default WhiteboardCanvas;