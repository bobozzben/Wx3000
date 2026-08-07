/**
 * FoxPro DBF to PostgreSQL Data Migration Helper Script
 * Wx3000 Project
 */

const fs = require('fs');
const path = require('path');

console.log('=== FoxPro DBF -> PostgreSQL Migration Utility ===');
console.log('Target Database: PostgreSQL 16 (a3000)');
console.log('Usage: Execute with DBF parser package to migrate legacy accounting DBF files.');
console.log('==================================================');
