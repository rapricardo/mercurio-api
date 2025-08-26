#!/usr/bin/env node

// Script to automatically instrument analytics controller endpoints with metrics
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'analytics', 'controllers', 'analytics.controller.ts');

console.log('Reading analytics controller file...');
let content = fs.readFileSync(filePath, 'utf8');

// Function to add metrics instrumentation to an endpoint method
function instrumentEndpoint(content, methodName, endpointName) {
  const methodPattern = new RegExp(
    `(async ${methodName}\\([^)]*\\):[^{]*{\\s*)` +
    `(const startTime = Date\\.now\\(\\);\\s*)` +
    `(try {[\\s\\S]*?)` +
    `(this\\.logger\\.log\\([^;]+;)([\\s\\S]*?)` +
    `(return result;[\\s\\S]*?)` +
    `(} catch \\(error\\) {[\\s\\S]*?)` +
    `(this\\.logger\\.error\\([^;]+;)([\\s\\S]*?)` +
    `(throw error;)`,
    'g'
  );

  const replacement = `$1$2$3
      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('${endpointName}', duration, tenant.tenantId.toString(), false${endpointName === 'timeseries' ? ', result.data.length' : endpointName.includes('events') ? ', result.events?.length' : ''});

      $4$5$6$7
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests
      this.recordMetrics('${endpointName}', duration, tenant.tenantId.toString(), false);

      $8$9$10`;

  return content.replace(methodPattern, replacement);
}

// Instrument each endpoint
console.log('Instrumenting endpoints...');

// Already done: overview and timeseries

// Instrument getTopEvents
content = content.replace(
  /(async getTopEvents\([^)]*\):[^{]*{\s*const startTime = Date\.now\(\);\s*try {[\s\S]*?this\.logger\.log\('Top events retrieved', {[\s\S]*?}\);)([\s\S]*?return result;)([\s\S]*?} catch \(error\) {[\s\S]*?this\.logger\.error\('Failed to get top events', {[\s\S]*?}\);)/,
  `$1

      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('top_events', duration, tenant.tenantId.toString(), false, result.events?.length);
$2$3
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests
      this.recordMetrics('top_events', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to get top events', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });`
);

// Instrument getUserAnalytics 
content = content.replace(
  /(async getUserAnalytics\([^)]*\):[^{]*{\s*const startTime = Date\.now\(\);\s*try {[\s\S]*?this\.logger\.log\('User analytics retrieved', {[\s\S]*?}\);)([\s\S]*?return result;)([\s\S]*?} catch \(error\) {[\s\S]*?this\.logger\.error\('Failed to get user analytics', {[\s\S]*?}\);)/,
  `$1

      const duration = Date.now() - startTime;
      
      // Record performance metrics
      this.recordMetrics('users', duration, tenant.tenantId.toString(), false);
$2$3
      const duration = Date.now() - startTime;
      
      // Still record metrics for failed requests
      this.recordMetrics('users', duration, tenant.tenantId.toString(), false);

      this.logger.error('Failed to get user analytics', {
        tenantId: tenant.tenantId.toString(),
        workspaceId: tenant.workspaceId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });`
);

console.log('Writing updated file...');
fs.writeFileSync(filePath, content);

console.log('✅ Analytics controller instrumented successfully!');