function computeLineOffsets(text) {
  const offsets = [0];
  let idx = 0;
  while (true) {
    const nl = text.indexOf("\n", idx);
    if (nl === -1) break;
    offsets.push(nl + 1);
    idx = nl + 1;
  }
  return offsets;
}

function posToByte(offsets, line, column) {
  if (line < 0) line = 0;
  if (line >= offsets.length) line = offsets.length - 1;
  return offsets[line] + column;
}

function sliceByLoc(text, loc) {
  const offsets = computeLineOffsets(text);
  const start = posToByte(offsets, loc.startLine, loc.startCol);
  const end = posToByte(offsets, loc.endLine, loc.endCol);
  return text.slice(start, end);
}

module.exports = { computeLineOffsets, posToByte, sliceByLoc };
