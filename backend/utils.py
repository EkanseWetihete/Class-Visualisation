import os
from collections import defaultdict

def get_py_files(root_dir):
    py_files = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith('.py'):
                py_files.append(os.path.join(dirpath, filename))
    return py_files

def resolve_import(imp, file_path, root_dir, all_files):
    module_path = imp['module'].replace('.', os.sep) + '.py'
    possible_paths = [os.path.join(root_dir, module_path), os.path.join(os.path.dirname(file_path), module_path)]
    for p in possible_paths:
        if p in all_files:
            return p
    return None

def build_relationships(files_data, root_dir):
    # Build symbol to file mapping
    symbol_to_file = defaultdict(list)
    for file_path, data in files_data.items():
        if data:
            for cls in data['classes']:
                symbol_to_file[cls['name']].append(file_path)
            for func in data['functions']:
                symbol_to_file[func['name']].append(file_path)

    relationships = defaultdict(set)
    for file_path, data in files_data.items():
        if not data:
            continue
        # From imports
        for imp in data['imports']:
            # For simplicity, assume module name corresponds to file
            # This is rough; real module resolution is complex
            module_path = imp['module'].replace('.', os.sep) + '.py'
            possible_paths = [os.path.join(root_dir, module_path)]
            # Also check relative
            rel_path = os.path.join(os.path.dirname(file_path), module_path)
            possible_paths.append(rel_path)
            for p in possible_paths:
                if os.path.exists(p):
                    relationships[file_path].add(p)
                    break
        # From usages
        defined_in_file = {cls['name'] for cls in data['classes']} | {func['name'] for func in data['functions']}
        imported_names = {imp['as'] or imp['module'].split('.')[-1] for imp in data['imports']}
        for name in data['used_names']:
            if name not in defined_in_file and name not in imported_names:
                if name in symbol_to_file:
                    for dep_file in symbol_to_file[name]:
                        relationships[file_path].add(dep_file)

    return {k: list(v) for k, v in relationships.items()}
    # Build symbol to file mapping
    symbol_to_file = defaultdict(list)
    for file_path, data in files_data.items():
        if data:
            for cls in data['classes']:
                symbol_to_file[cls['name']].append(file_path)
            for func in data['functions']:
                symbol_to_file[func['name']].append(file_path)

    relationships = defaultdict(set)
    for file_path, data in files_data.items():
        if not data:
            continue
        # From imports
        for imp in data['imports']:
            # For simplicity, assume module name corresponds to file
            # This is rough; real module resolution is complex
            module_path = imp['module'].replace('.', os.sep) + '.py'
            possible_paths = [os.path.join(root_dir, module_path)]
            # Also check relative
            rel_path = os.path.join(os.path.dirname(file_path), module_path)
            possible_paths.append(rel_path)
            for p in possible_paths:
                if os.path.exists(p):
                    relationships[file_path].add(p)
                    break
        # From usages
        defined_in_file = {cls['name'] for cls in data['classes']} | {func['name'] for func in data['functions']}
        imported_names = {imp['as'] or imp['module'].split('.')[-1] for imp in data['imports']}
        for name in data['used_names']:
            if name not in defined_in_file and name not in imported_names:
                if name in symbol_to_file:
                    for dep_file in symbol_to_file[name]:
                        relationships[file_path].add(dep_file)

    return {k: list(v) for k, v in relationships.items()}