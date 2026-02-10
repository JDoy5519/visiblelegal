#!/usr/bin/env node
/**
 * Mixed Content Guardrail Script
 * 
 * Scans the repository for HTTP references and exits with non-zero status
 * if any insecure HTTP references are found (excluding allow-listed patterns).
 * 
 * Usage: node scripts/check-no-http.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Allow-listed patterns (edit these if needed)
const ALLOWED_PATTERNS = [
  /^http:\/\/localhost/,
  /^http:\/\/127\.0\.0\.1/,
  /^http:\/\/0\.0\.0\.0/,
  /^http:\/\/www\.w3\.org\/2000\/svg/,  // SVG namespace declarations
];

// File extensions to scan
const SCAN_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.js', '.json', '.svg', '.xml', '.txt', '.md'
]);

// Directories to exclude
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'coverage',
  'assets', 'images', 'img', 'static', 'public' // Often contain binaries
]);

// Files to exclude
const EXCLUDE_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
]);

/**
 * Check if a path should be excluded
 */
function shouldExcludePath(filePath) {
  const parts = filePath.split('/');
  
  // Check if any directory in the path is excluded
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) {
      return true;
    }
  }
  
  // Check if file is excluded
  const fileName = parts[parts.length - 1];
  if (EXCLUDE_FILES.has(fileName)) {
    return true;
  }
  
  return false;
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath) {
  const files = [];
  
  try {
    const entries = readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!shouldExcludePath(fullPath)) {
          files.push(...scanDirectory(fullPath));
        }
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (SCAN_EXTENSIONS.has(ext) && !shouldExcludePath(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not scan directory ${dirPath}: ${err.message}`);
  }
  
  return files;
}

/**
 * Check file for HTTP references
 */
function checkFile(filePath) {
  const issues = [];
  
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Find all HTTP references
      const httpMatches = line.match(/https?:\/\/[^\s"'<>]+/g);
      
      if (httpMatches) {
        httpMatches.forEach(match => {
          // Check if it's an allowed pattern
          const isAllowed = ALLOWED_PATTERNS.some(pattern => pattern.test(match));
          
          if (!isAllowed && match.startsWith('http://')) {
            issues.push({
              file: filePath,
              line: index + 1,
              match: match,
              context: line.trim()
            });
          }
        });
      }
    });
  } catch (err) {
    console.warn(`Warning: Could not read file ${filePath}: ${err.message}`);
  }
  
  return issues;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Scanning for mixed content (HTTP references)...\n');
  
  const files = scanDirectory(PROJECT_ROOT);
  console.log(`📁 Found ${files.length} files to scan\n`);
  
  const allIssues = [];
  
  for (const file of files) {
    const issues = checkFile(file);
    allIssues.push(...issues);
  }
  
  if (allIssues.length === 0) {
    console.log('✅ No mixed content issues found!');
    console.log('🔒 All HTTP references are either HTTPS or allow-listed.');
    process.exit(0);
  }
  
  console.log(`❌ Found ${allIssues.length} mixed content issue(s):\n`);
  
  allIssues.forEach((issue, index) => {
    const relativePath = issue.file.replace(PROJECT_ROOT, '.').replace(/\\/g, '/');
    console.log(`${index + 1}. ${relativePath}:${issue.line}`);
    console.log(`   HTTP URL: ${issue.match}`);
    console.log(`   Context:  ${issue.context}`);
    console.log('');
  });
  
  console.log('💡 To fix these issues:');
  console.log('   • Replace http:// with https:// where possible');
  console.log('   • Download assets locally if HTTPS is not available');
  console.log('   • Add patterns to ALLOWED_PATTERNS if they are safe');
  console.log('');
  
  process.exit(1);
}

// Run the check
main();
