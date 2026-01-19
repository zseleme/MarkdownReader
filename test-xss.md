# XSS Protection Test

This document tests various XSS attack vectors to ensure DOMPurify is working correctly.

## Test 1: Script Tag
<script>alert('XSS')</script>

## Test 2: Image with onerror
<img src=x onerror="alert('XSS')">

## Test 3: SVG with onload
<svg onload="alert('XSS')">

## Test 4: Iframe
<iframe src="javascript:alert('XSS')"></iframe>

## Test 5: Link with javascript:
<a href="javascript:alert('XSS')">Click me</a>

## Test 6: Safe content
This is normal **bold** text with a [safe link](https://example.com).

- List item 1
- List item 2

```javascript
// This is safe code in a code block
console.log('Hello World');
```

## Expected Results
All XSS attempts above should be sanitized and not execute. Only the safe content should render properly.
