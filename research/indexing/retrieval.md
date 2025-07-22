teach the model to retrieve code based on a query, natural language like cursor

when requesting code, we will return top n similar snippets

- if a snippet INSIDE a function, show the full function in context
- GRAPH
  - if that context is called by another function, pass in that context (or the natural language context of it)
  - if that function calls another function, pass that into context --> add recursion child limits
- pass in the natural language related parts of the code to the model
- pass any relevant types

also enable grep search

- knows function name or variable, direct search
- able to limit by folder
