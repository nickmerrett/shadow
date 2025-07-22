- great to use with any programming language, very generalizable
- value of tree sitter is speed and individual file parsing, creating these abstractions are useful but not sufficient

**i am unable to**

- see how functions relate to the other
- evaluate what types (and from which files) influence this code

```txt
(program (import_statement (import_clause (named_imports (import_specifier name: (identifier)))) source: (string (string_fragment))) (export_statement declaration: (function_declaration name: (identifier) parameters: (formal_parameters) body: (statement_block (return_statement (parenthesized_expression (jsx_element open_tag: (jsx_opening_element name: (identifier) attribute: (jsx_attribute (property_identifier) (string (string_fragment)))) (jsx_self_closing_element name: (identifier)) close_tag: (jsx_closing_element name: (identifier)))))))))
```

here is a sample syntax tree of a typescript file (page.tsx).

it makes more sense to do something similar to cmd+click in vscode where you can see where functions are defined/called.
