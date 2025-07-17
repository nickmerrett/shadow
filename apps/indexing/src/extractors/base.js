function walk(node, fn){
    fn(node);
    const nChildren = node.namedChildCount;
    for(let i=0;i<nChildren;i++){
      const child = node.namedChild(i);
      walk(child, fn);
    }
  }
  
  function nodeLoc(node){
    return {
      startLine: node.startPosition.row,
      startCol:  node.startPosition.column,
      endLine:   node.endPosition.row,
      endCol:    node.endPosition.column,
      byteStart: node.startIndex,
      byteEnd:   node.endIndex,
    };
  }
  
  module.exports = { walk, nodeLoc };
  