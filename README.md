# Code Visualization System

A professional UML-style code visualization tool built with Next.js that provides interactive visual analysis of Python codebases.

## Features

### 🎨 **UML-Style Design**
- **File Category Boxes**: Each Python file is displayed as a large container box with its path as the title
- **Function/Class Boxes**: Individual functions and classes are rendered as styled boxes inside their file containers
- **Methods Display**: Classes show their methods in a clean, organized list
- **Color-Coded Elements**:
  - File boxes: White with blue border
  - Class boxes: Light blue with darker blue border
  - Function boxes: Light purple with dark purple border

### 📐 **Smart Coordinate System**
- **Grid Layout**: Files are automatically arranged in a 3-column grid
- **Consistent Padding**: 
  - 30px padding inside file boxes
  - 15px spacing between function/class items
  - 100px horizontal margin between file columns
  - 80px vertical margin between file rows
- **Dynamic Sizing**: Boxes automatically size based on content (methods, arguments, etc.)
- **Predictable Positioning**: All elements have fixed coordinates, not randomly placed

### 🔗 **Smart Arrow Connections**
- **Function Dependencies**: Lines with arrows show which functions/classes use other functions
- **Cross-File References**: Arrows elegantly connect items across different file boxes
- **Curved Routing**: Smooth bezier curves for better visual clarity
- **Collision Avoidance**: Arrows route around boxes when possible to minimize overlap
- **Labels**: Connection labels show the name of the function being called

### 🎮 **Interactive Controls**
- **Pan & Zoom**: 
  - Mouse wheel to zoom in/out
  - Click and drag to pan around the canvas
  - Zoom range: 10% to 300%
- **Control Panel**: Buttons for Zoom In, Zoom Out, and Reset view
- **Hover Effects**: Boxes and connections highlight on hover
- **Smooth Transitions**: All interactions have smooth animations

### 📊 **Data Structure**
The system reads from `output.json` which contains:
```json
{
  "files": {
    "path/to/file.py": {
      "FunctionName": {
        "args": ["arg1", "arg2"],
        "start_line": 10,
        "end_line": 20,
        "used_functions": {
          "other_function": "from module.name"
        }
      },
      "ClassName": {
        "args": [],
        "methods": {
          "method_name": { ... }
        },
        "used_functions": { ... }
      }
    }
  }
}
```

## How to Use

### Installation
```bash
cd frontend
npm install
```

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Production
```bash
npm run build
npm start
```

## Analyzing New Projects

1. Place your Python project in the `backend` analyzer
2. Run the analyzer to generate `output.json`
3. The frontend will automatically display the new analysis
4. Use the visualization to:
   - Understand code structure
   - Trace function dependencies
   - Identify cross-module relationships
   - Navigate complex codebases visually

## Design Philosophy

- **Clean UML Style**: Familiar diagram style for developers
- **Information Density**: Shows comprehensive data without clutter
- **Visual Hierarchy**: Clear distinction between files, classes, and functions
- **Accessibility**: Easy navigation and interaction for all users
- **Performance**: Efficient rendering even for large codebases
- **Flexibility**: Easily adaptable for different project structures

## Technical Stack

- **Next.js 14**: React framework for server-side rendering
- **TypeScript**: Type-safe development
- **SVG Rendering**: Crisp, scalable graphics
- **CSS Modules**: Scoped styling
- **Custom Layout Algorithm**: Grid-based positioning with smart routing

## Future Enhancements

- Search and filter functions
- Collapse/expand file boxes
- Export as PNG/SVG
- Dark mode support
- Minimap for large diagrams
- Custom color themes
- Code preview on hover
