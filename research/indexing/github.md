https://github.blog/engineering/architecture-optimization/the-technology-behind-githubs-new-code-search/

A search index primer
We can only make queries fast if we pre-compute a bunch of information in the form of indices, which you can think of as maps from keys to sorted lists of document IDs (called “posting lists”) where that key appears. As an example, here’s a small index for programming languages. We scan each document to detect what programming language it’s written in, assign a document ID, and then create an inverted index where language is the key and the value is a posting list of document IDs.

Forward index
Doc ID	Content
1	def lim
puts “mit”
end
2	fn limits() ...
3	function mits() ...

Inverted index
Language	Doc IDs (postings)
JavaScript	3, 8, 12, …
Ruby	1, 10, 13, …
Rust	2, 5, 11, …
