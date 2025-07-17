//PLACEHOLDER

const crypto = require('crypto');

function cheapHashEmbedding(text, dim=256){
  const buf = Buffer.from(text);
  const vec = new Float32Array(dim);
  for(let i=0;i<buf.length;i++){
    vec[buf[i] % dim] += 1;
  }
  // L2 normalize
  let norm=0; for(let i=0;i<dim;i++) norm+=vec[i]*vec[i];
  norm = Math.sqrt(norm) || 1;
  for(let i=0;i<dim;i++) vec[i]/=norm;
  return vec;
}

async function embedChunks(chunks, {dim=256, embedFn=cheapHashEmbedding}={}){
  for(const ch of chunks){
    ch.embedding = embedFn(ch.code || '');
  }
  return chunks;
}

module.exports = { embedChunks, cheapHashEmbedding };
