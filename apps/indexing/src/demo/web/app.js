// Simple JS demo to ensure multi-language indexing

export function greet(name) {
  return `Hello ${name}!`;
}

export function square(n) {
  return n * n;
}

// Example usage (not executed when imported)
if (typeof window === 'undefined') {
  console.log(greet('Shadow'));
  console.log('square(5) ->', square(5));
} 