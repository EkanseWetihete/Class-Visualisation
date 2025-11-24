import os
import json
import argparse
from collections import defaultdict
from analyzer import analyze_file
from utils import get_py_files


def normalize_dir(path):
    return os.path.abspath(os.path.normpath(path))


def is_within(root, candidate):
    try:
        return os.path.commonpath([root, candidate]) == root
    except ValueError:
        return False


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_scan_root = os.path.abspath(os.path.join(script_dir, os.pardir))
    parser = argparse.ArgumentParser(description='Analyze Python project structure for visualization output.')
    parser.add_argument(
        'scan_root_pos',
        nargs='?',
        help='Root directory that will be fully scanned for symbol definitions (positional, overrides --scan-root).'
    )
    parser.add_argument(
        'focus_root_pos',
        nargs='?',
        help='Directory whose files should be rendered in the visualization (positional, overrides --focus-root).'
    )
    parser.add_argument(
        '--scan-root',
        '--entire-project',
        dest='scan_root',
        default=default_scan_root,
        help='Root directory that will be fully scanned for symbol definitions (default: project root).'
    )
    parser.add_argument(
        '--focus-root',
        '--read-project',
        dest='focus_root',
        default=script_dir,
        help='Directory whose files should be rendered in the visualization (default: backend folder).'
    )
    parser.add_argument(
        '--output',
        dest='output_path',
        default=os.path.join(script_dir, 'output.json'),
        help='Destination path for the generated JSON (default: backend/output.json).'
    )
    args = parser.parse_args()

    scan_root = normalize_dir(args.scan_root_pos) if args.scan_root_pos else normalize_dir(args.scan_root)
    focus_root = normalize_dir(args.focus_root_pos) if args.focus_root_pos else normalize_dir(args.focus_root)
    output_path = os.path.abspath(args.output_path)

    if not os.path.isdir(scan_root):
        raise FileNotFoundError(f'Scan root does not exist: {scan_root}')
    if not os.path.isdir(focus_root):
        raise FileNotFoundError(f'Focus root does not exist: {focus_root}')
    if not is_within(scan_root, focus_root):
        raise ValueError('Focus root must be inside the scan root so dependencies can be resolved correctly.')

    py_files = get_py_files(scan_root)
    file_module_info = {}
    module_to_file = {}
    for file_path in py_files:
        rel_path = os.path.relpath(file_path, scan_root)
        module = rel_path.replace(os.sep, '.').replace('.py', '')
        display = f'from {module}'
        file_module_info[file_path] = {'module': module, 'display': display}
        module_to_file[module] = file_path
        if module.endswith('__init__'):
            package_name = module.rsplit('.', 1)[0] if '.' in module else ''
            if package_name:
                module_to_file[package_name] = file_path

    files_data = {}
    for file_path in py_files:
        data = analyze_file(file_path)
        if data:
            files_data[file_path] = data['definitions']

    symbol_to_file = defaultdict(list)
    for file_path, definitions in files_data.items():
        module_display = file_module_info[file_path]['display']
        for def_name in definitions:
            symbol_to_file[def_name].append({'file_path': file_path, 'display': module_display})

    for file_path, definitions in files_data.items():
        new_definitions = {}
        for def_name, def_data in definitions.items():
            if def_data['type'] == 'class':
                class_data = dict(def_data)
                class_data['methods'] = {}
                new_definitions[def_name] = class_data
        for def_name, def_data in definitions.items():
            if def_data['type'] == 'function' and '.' in def_name:
                class_name, method_name = def_name.split('.', 1)
                if class_name in new_definitions:
                    new_definitions[class_name]['methods'][method_name] = dict(def_data)
            elif def_data['type'] == 'function':
                new_definitions[def_name] = dict(def_data)
        files_data[file_path] = new_definitions

    focus_files = {path for path in files_data.keys() if is_within(focus_root, path)}

    def resolve_symbol(name, preferred_file=None):
        entries = symbol_to_file.get(name, [])
        if preferred_file:
            for entry in entries:
                if entry['file_path'] == preferred_file and entry['file_path'] in focus_files:
                    return entry
        for entry in entries:
            if entry['file_path'] in focus_files:
                return entry
        return None

    def build_used_functions(def_data):
        used_functions = {}
        for name in def_data.get('used_names', set()):
            target = resolve_symbol(name)
            if target:
                used_functions[name] = target['display']
        for base, methods in def_data.get('used_classes_methods', {}).items():
            target = resolve_symbol(base)
            if target and methods:
                used_functions[base] = {
                    'file': target['display'],
                    'methods': sorted(methods)
                }
                continue
            module_file = module_to_file.get(base)
            if module_file and module_file in focus_files:
                for method_name in sorted(methods):
                    method_target = resolve_symbol(method_name, preferred_file=module_file)
                    if method_target:
                        used_functions[method_name] = method_target['display']
        def_data['used_functions'] = used_functions
        def_data.pop('used_names', None)
        def_data.pop('used_classes_methods', None)
        def_data.pop('type', None)

    for file_path, definitions in files_data.items():
        for def_name, def_data in definitions.items():
            build_used_functions(def_data)
            if 'methods' in def_data:
                for method_data in def_data['methods'].values():
                    build_used_functions(method_data)

    parent_dir = os.path.dirname(scan_root)
    output_files = {}
    output_meta = {}
    for file_path, data in files_data.items():
        if file_path not in focus_files:
            continue
        rel_path = os.path.relpath(file_path, parent_dir).replace(os.sep, '/')
        output_files[rel_path] = data
        output_meta[rel_path] = {
            'is_router': os.path.basename(file_path) == '__init__.py',
            'module': file_module_info[file_path]['module']
        }

    output = {
        'files': output_files,
        'file_meta': output_meta,
        'config': {
            'scan_root': scan_root,
            'focus_root': focus_root
        }
    }

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=4)
    print(f'Analysis complete. Output saved to {output_path}')

# Usage: python main.py [scan_root] [focus_root]
# scan_root: Root directory to scan for symbol definitions (default: project root)
# focus_root: Directory whose files to render in visualization (default: backend)
# Example: <...\Class Visualisation\backend> python main.py . complicated_project 
if __name__ == '__main__':
    main()
