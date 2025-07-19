# Create a test workspace with some sample code
mkdir -p /Users/ishaandey/Documents/Programming/shadow/test-workspace
cd /Users/ishaandey/Documents/Programming/shadow/test-workspace

# Add some sample files to test with
echo "console.log('Hello World');" > index.js
echo "def hello(): return 'world'" > main.py
mkdir src
echo "export const greet = () => 'hello';" > src/utils.ts