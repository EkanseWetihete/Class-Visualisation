import ast
import os
from collections import defaultdict

class CodeAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.scopes = []
        self.definitions = {}

    def visit_ClassDef(self, node):
        name = node.name
        self.definitions[name] = {
            'type': 'class',
            'args': [],  # classes don't have args like functions
            'start_line': node.lineno,
            'end_line': node.end_lineno,
            'used_names': set(),
            'used_classes_methods': defaultdict(set)
        }
        self.scopes.append(name)
        self.generic_visit(node)
        self.scopes.pop()

    def visit_FunctionDef(self, node):
        name = node.name
        full_name = f"{self.scopes[-1]}.{name}" if self.scopes and self.definitions[self.scopes[-1]]['type'] == 'class' else name
        self.definitions[full_name] = {
            'type': 'function',
            'args': [arg.arg for arg in node.args.args],
            'start_line': node.lineno,
            'end_line': node.end_lineno,
            'used_names': set(),
            'used_classes_methods': defaultdict(set)
        }
        self.scopes.append(full_name)
        self.generic_visit(node)
        self.scopes.pop()

    def visit_AsyncFunctionDef(self, node):
        self.visit_FunctionDef(node)  # Treat async as regular

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load) and self.scopes:
            self.definitions[self.scopes[-1]]['used_names'].add(node.id)

    def visit_Attribute(self, node):
        if isinstance(node.value, ast.Name) and self.scopes:
            self.definitions[self.scopes[-1]]['used_classes_methods'][node.value.id].add(node.attr)
        self.generic_visit(node)

    # No need for imports anymore, since we skip external

def analyze_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        tree = ast.parse(source, filename=file_path)
        analyzer = CodeAnalyzer()
        analyzer.visit(tree)
        return {'definitions': analyzer.definitions}
    except SyntaxError as e:
        print(f"Syntax error in {file_path}: {e}")
        return None
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}")
        return None