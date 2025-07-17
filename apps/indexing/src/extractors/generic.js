const { nodeLoc } = require('./base');

function extractGeneric(root, spec, sourceText){
  const defs = [];
  const imports = [];
  const calls = [];
  const docs = [];

  function collect(node){
    const t = node.type;
    if(spec.symbols.includes(t)){
      // Get name heuristically: find first child that's an identifier
      let name = null;
      for(let i=0;i<node.namedChildCount;i++){
        const c = node.namedChild(i);
        if(/identifier|name|type_identifier|field_identifier/.test(c.type)){
          name = c.text || sourceText.slice(c.startIndex, c.endIndex);
          break;
        }
      }
      if(!name){
        // fallback to text slice limited
        name = sourceText.slice(node.startIndex, Math.min(node.startIndex+32,node.endIndex)).trim();
      }
      defs.push({node, name, loc:nodeLoc(node)});
    }
    if(spec.imports.includes(t)){
      imports.push({node, loc:nodeLoc(node)});
    }
    if(spec.calls && spec.calls.includes(t)){
      calls.push({node, loc:nodeLoc(node)});
    }
    if(spec.docs && spec.docs.includes(t)){
      docs.push({node, loc:nodeLoc(node)});
    }
    // no recursion here; caller handles
  }

  // manual stack to avoid recursion blowups
  const stack=[root];
  while(stack.length){
    const n = stack.pop();
    collect(n);
    for(let i=0;i<n.namedChildCount;i++) stack.push(n.namedChild(i));
  }

  return {defs, imports, calls, docs};
}

module.exports = { extractGeneric };
