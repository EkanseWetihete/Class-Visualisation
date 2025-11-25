import ast
from collections import defaultdict

API_DECORATOR_KEYWORDS = {
    'route',
    'router',
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'options',
    'head',
    'api',
    'api_view',
    'endpoint'
}

class CodeAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.scopes = []
        self.definitions = {}
        self.aliases = {}
        # Track instance attribute assignments: self.attr = ClassName()
        # Maps (class_name, attr_name) -> original_class_name
        self.instance_attr_types = {}

    def visit_ClassDef(self, node):
        name = node.name
        self.definitions[name] = {
            'type': 'class',
            'args': [],  # classes don't have args like functions
            'start_line': node.lineno,
            'end_line': node.end_lineno,
            'used_names': set(),
            'used_classes_methods': defaultdict(set),
            'is_api_endpoint': False
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
            'used_classes_methods': defaultdict(set),
            'is_api_endpoint': self._is_api_endpoint(node)
        }
        self.scopes.append(full_name)
        self.generic_visit(node)
        self.scopes.pop()

    def visit_AsyncFunctionDef(self, node):
        self.visit_FunctionDef(node)  # Treat async as regular

    def visit_Assign(self, node):
        """Track self.attr = ClassName() assignments for instance attribute type inference."""
        for target in node.targets:
            if (isinstance(target, ast.Attribute) and 
                isinstance(target.value, ast.Name) and 
                target.value.id == 'self' and
                self.scopes):
                
                # We're assigning to self.something
                attr_name = target.attr
                assigned_class = self._extract_class_from_value(node.value)
                
                if assigned_class:
                    # Find the containing class
                    current_class = self._get_current_class()
                    if current_class:
                        self.instance_attr_types[(current_class, attr_name)] = assigned_class
        
        self.generic_visit(node)
    
    def _extract_class_from_value(self, node):
        """Extract the class name from an assignment value (e.g., ClassName() or aliased_name())."""
        if isinstance(node, ast.Call):
            # It's a call like ClassName() or AliasedName()
            if isinstance(node.func, ast.Name):
                # Resolve through import aliases
                return self._canonical_name(node.func.id)
            elif isinstance(node.func, ast.Attribute):
                # module.ClassName()
                return node.func.attr
        elif isinstance(node, ast.Name):
            # Direct assignment like self.attr = SomeClass (without call)
            return self._canonical_name(node.id)
        return None
    
    def _get_current_class(self):
        """Get the current class name from the scope stack."""
        for scope in reversed(self.scopes):
            if scope in self.definitions and self.definitions[scope]['type'] == 'class':
                return scope
        return None

    def visit_Import(self, node):
        for alias in node.names:
            if alias.asname:
                self.aliases[alias.asname] = {
                    'kind': 'module',
                    'module': alias.name
                }

    def visit_ImportFrom(self, node):
        module = node.module or ''
        for alias in node.names:
            if alias.name == '*':
                continue
            alias_name = alias.asname or alias.name
            self.aliases[alias_name] = {
                'kind': 'symbol',
                'symbol': alias.name,
                'module': module
            }

    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load) and self.scopes:
            canonical = self._canonical_name(node.id)
            self.definitions[self.scopes[-1]]['used_names'].add(canonical)

    def visit_Attribute(self, node):
        if self.scopes:
            # Check for self.attr.method pattern
            if (isinstance(node.value, ast.Attribute) and 
                isinstance(node.value.value, ast.Name) and 
                node.value.value.id == 'self'):
                # This is self.something.method_or_attr
                attr_name = node.value.attr
                method_name = node.attr
                current_class = self._get_current_class()
                
                if current_class:
                    # Try to resolve self.attr to its original class
                    original_class = self.instance_attr_types.get((current_class, attr_name))
                    if original_class:
                        # We found the original class, record it as a used class method
                        self.definitions[self.scopes[-1]]['used_classes_methods'][original_class].add(method_name)
                        self.generic_visit(node)
                        return
            
            # Original logic: base.method pattern
            if isinstance(node.value, ast.Name):
                base_name = self._canonical_attr_base(node.value.id)
                self.definitions[self.scopes[-1]]['used_classes_methods'][base_name].add(node.attr)
        
        self.generic_visit(node)

    # No need for imports anymore, since we skip external

    def _canonical_name(self, name):
        info = self.aliases.get(name)
        if not info:
            return name
        if info.get('kind') == 'symbol':
            return info.get('symbol', name)
        return name

    def _canonical_attr_base(self, name):
        info = self.aliases.get(name)
        if not info:
            return name
        if info.get('kind') == 'symbol':
            return info.get('symbol', name)
        if info.get('kind') == 'module':
            return info.get('module', name)
        return name

    def _is_api_endpoint(self, node):
        for decorator in getattr(node, 'decorator_list', []):
            target = decorator
            while isinstance(target, ast.Call):
                target = target.func
            names = []
            while isinstance(target, ast.Attribute):
                names.append(target.attr.lower())
                target = target.value
            if isinstance(target, ast.Name):
                names.append(target.id.lower())
            if any(name in API_DECORATOR_KEYWORDS for name in names):
                return True
        return False

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