import os
import json
import argparse
from analyzer import analyze_file
from utils import get_py_files
from collections import defaultdict

def main():
    # Automatically set root_dir to the parent of the script's directory
    script_dir = os.path.dirname(__file__)
    root_dir = os.path.dirname(script_dir)
    root_dir = os.path.abspath(root_dir)
    py_files = get_py_files(root_dir)

    # Create file to module mapping
    file_to_module = {}
    for file_path in py_files:
        rel_path = os.path.relpath(file_path, root_dir)
        module = rel_path.replace(os.sep, '.').replace('.py', '')
        file_to_module[file_path] = f"from {module}"

    files_data = {}
    for file_path in py_files:
        data = analyze_file(file_path)
        if data:
            files_data[file_path] = data['definitions']

    # Build symbol to module map
    symbol_to_file = defaultdict(list)
    for file_path, definitions in files_data.items():
        module_str = file_to_module[file_path]
        for def_name in definitions:
            symbol_to_file[def_name].append(module_str)

    # Process definitions to nest methods under classes
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
                    new_definitions[class_name]['methods'][method_name] = def_data
            elif def_data['type'] == 'function':
                new_definitions[def_name] = def_data
        files_data[file_path] = new_definitions

    # Process used functions
    for file_path, definitions in files_data.items():
        for def_name, def_data in definitions.items():
            if 'methods' in def_data:
                # For class
                used_functions = {}
                for name in def_data.get('used_names', set()):
                    if name in symbol_to_file:
                        used_functions[name] = symbol_to_file[name][0]
                for cls, methods in def_data.get('used_classes_methods', {}).items():
                    if cls in symbol_to_file:
                        used_functions[cls] = {
                            'file': symbol_to_file[cls][0],
                            'methods': list(methods)
                        }
                def_data['used_functions'] = used_functions
                def_data.pop('used_names', None)
                def_data.pop('used_classes_methods', None)
                def_data.pop('type', None)
                # For methods
                for method_name, method_data in def_data['methods'].items():
                    used_functions = {}
                    for name in method_data.get('used_names', set()):
                        if name in symbol_to_file:
                            used_functions[name] = symbol_to_file[name][0]
                    for cls, methods in method_data.get('used_classes_methods', {}).items():
                        if cls in symbol_to_file:
                            used_functions[cls] = {
                                'file': symbol_to_file[cls][0],
                                'methods': list(methods)
                            }
                    method_data['used_functions'] = used_functions
                    method_data.pop('used_names', None)
                    method_data.pop('used_classes_methods', None)
                    method_data.pop('type', None)
            else:
                # For function
                used_functions = {}
                for name in def_data.get('used_names', set()):
                    if name in symbol_to_file:
                        used_functions[name] = symbol_to_file[name][0]
                for cls, methods in def_data.get('used_classes_methods', {}).items():
                    if cls in symbol_to_file:
                        used_functions[cls] = {
                            'file': symbol_to_file[cls][0],
                            'methods': list(methods)
                        }
                def_data['used_functions'] = used_functions
                def_data.pop('used_names', None)
                def_data.pop('used_classes_methods', None)
                def_data.pop('type', None)

    # Change file keys to relative paths
    output_files = {}
    parent_dir = os.path.dirname(root_dir)
    for file_path, data in files_data.items():
        rel_path = os.path.relpath(file_path, parent_dir).replace(os.sep, '/')
        output_files[rel_path] = data

    output = {'files': output_files}
    with open('output.json', 'w') as f:
        json.dump(output, f, indent=4)
    print("Analysis complete. Output saved to output.json")

if __name__ == '__main__':
    main()
