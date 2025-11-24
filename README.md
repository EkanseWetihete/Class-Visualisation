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
  - API endpoints: Deep purple boxes with an "API" badge for quick scanning
  - Router (`__init__.py`) files: Orange-accented outlines with a router badge under the title

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
- **Control Panel**: Buttons for Zoom In, Zoom Out, Reset View, Refresh Data, Save Layout, and Load/Manage
- **Highlight Toggles**: Checkboxes to enable/disable outgoing (green) and incoming (yellow) reference highlights
- **Hover Effects**: Boxes and connections highlight on hover
- **Smooth Transitions**: All interactions have smooth animations

### 🔍 **Reference Highlighting**
- **Outgoing References**: Right-click on a file, class, or function to highlight all items it references (green arrows and boxes)
- **Incoming References**: Right-click to also highlight all items that reference the selected entity (yellow arrows and boxes)
- **Toggle Controls**: Independent toggles to show/hide outgoing or incoming highlights
- **Visual Feedback**: Selected items have red borders, highlighted references use color-coded arrows and fills

### 💾 **Layout Management**
- **Save Layouts**: Save current drag positions as named layouts, scoped to the active data file
- **Load Layouts**: Restore saved layouts from a panel, automatically switching data files if needed
- **Load Panel**: Overlay interface to manage saved layouts and select different data files
- **Persistent Storage**: Layouts stored in localStorage with metadata (name, data file, timestamp)
- **Data File Selection**: Choose from multiple JSON files in the `data/` directory for visualization

### 📊 **Data Structure**
The system reads from JSON files in the `data/` directory (e.g., `output.json`), supporting multiple data files for different projects or analyses. Each file contains:
```json
{
  "files": {
    "path/to/file.py": {
      "FunctionName": {
        "args": ["arg1", "arg2"],
        "start_line": 10,
        "end_line": 20,
        "is_api_endpoint": true,
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
    },
    "file_meta": {
      "path/to/file.py": {
        "is_router": false,
        "module": "package.module"
      }
  },
  "_meta": {
    "version": "file_hash",
    "lastModified": 1234567890,
    "size": 1024,
    "file": "output.json"
  }
}
```

## Backend Analyzer

The system includes a Python-based backend analyzer that processes Python codebases to extract structural and dependency information.

### Features
- **AST Parsing**: Uses Python's `ast` module to analyze source code
- **Dependency Tracking**: Identifies function and class references across modules
- **Alias Awareness**: Resolves `import ... as ...` statements so references stay connected even when renamed
- **API Endpoint Detection**: Flags decorated view functions/endpoints so the UI can highlight them automatically
- **Metadata Generation**: Creates versioned JSON output with file metadata
- **Multi-File Support**: Processes entire project directories and generates separate JSON files
- **Scoped Scans**: Separate *scan root* and *focus root* let you analyze a whole project while only rendering the directories you care about

### Usage
```bash
cd backend
pip install -r requirements.txt
python main.py --scan-root .. --focus-root backend --output ..\data\output.json
```

- `--scan-root` / `--entire-project`: directory that will be fully traversed for symbol definitions (defaults to the project root)
- `--focus-root` / `--read-project`: directory whose files appear in the visualization (defaults to `backend`)
- `--output`: target JSON file (defaults to `backend/output.json`)

### Output
Generates JSON files in the `data/` directory with detailed code structure, including:
- Function and class definitions with arguments and line numbers
- Method lists for classes
- Cross-references between functions and modules
- API endpoint flags and router awareness for richer visuals
- File metadata (module name, router flag) plus analyzer config for traceability

The analyzer is designed to work with any Python project structure and can be extended for additional analysis features.

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
2. Install backend dependencies: `cd backend && pip install -r requirements.txt`
3. Run the analyzer: `python main.py --scan-root <entire project> --focus-root <directory to visualize> --output ..\data\output.json`
4. Generated JSON files will be saved to `data/` directory
5. The frontend will automatically list available data files
6. Use the visualization to:
   - Understand code structure
   - Trace function dependencies
   - Identify cross-module relationships
   - Navigate complex codebases visually
   - Save and load custom layouts for different views
   - Toggle highlights for outgoing/incoming references

## Design Philosophy

- **Clean UML Style**: Familiar diagram style for developers
- **Information Density**: Shows comprehensive data without clutter
- **Visual Hierarchy**: Clear distinction between files, classes, and functions
- **Accessibility**: Easy navigation and interaction for all users
- **Performance**: Efficient rendering even for large codebases
- **Flexibility**: Easily adaptable for different project structures

## Technical Stack

- **Frontend**:
  - Next.js 14: React framework for server-side rendering
  - TypeScript: Type-safe development
  - SVG Rendering: Crisp, scalable graphics
  - CSS Modules: Scoped styling
- **Backend**:
  - Python: Code analysis using AST parsing
  - JSON Output: Structured data for visualization
- **Features**:
  - Custom Layout Algorithm: Grid-based positioning with smart routing
  - Local Storage: Persistent layout management
  - API Routes: Dynamic data file loading and listing

## Future Enhancements

- Search and filter functions
- Collapse/expand file boxes
- Export as PNG/SVG
- Dark mode support
- Minimap for large diagrams
- Custom color themes
- Code preview on hover
- Advanced layout algorithms
- Collaboration features for team code reviews
