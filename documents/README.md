# Documents Directory

This directory stores shared documents uploaded by users.

## Structure

Each document consists of two files:
- `doc_xxxxx.md` - The markdown content
- `doc_xxxxx.json` - Document metadata (title, creation date, etc.)

## Security

- Direct access to files is blocked via `.htaccess`
- All access must go through the API endpoints
- File IDs are validated to prevent directory traversal attacks
- Symlink attacks prevented with realpath validation
- Maximum file size is limited to 5MB
- Rate limiting: 10 saves per hour per IP address
- XSS protection: titles are sanitized
- CORS restricted to allowed domains only
- Content validation checks for suspicious patterns

## Maintenance

### Recommended Cleanup Strategy

Documents should be periodically removed to prevent disk space exhaustion. Recommended approaches:

1. **Automated Cron Job** (recommended for production):
   - Remove documents older than 30 days
   - Run daily at 3 AM
   - Keep logs of deleted files

2. **Manual Cleanup**:
   - Review and delete unused documents periodically
   - Check disk usage with `du -sh .`

3. **Future Enhancements**:
   - Database tracking for better management
   - User authentication for private documents
   - Document edit history
   - Last accessed timestamp tracking
   - Configurable expiration dates

## Cleanup Scripts

### Automated Cron Job (Linux/Mac)

Add to crontab (`crontab -e`):

```bash
# Clean up documents older than 30 days, daily at 3 AM
0 3 * * * /path/to/cleanup-documents.sh >> /var/log/mdreader-cleanup.log 2>&1
```

Create `/path/to/cleanup-documents.sh`:

```bash
#!/bin/bash
# MDReader Document Cleanup Script

DOCS_DIR="/path/to/MDReader/documents"
DAYS=30

echo "$(date): Starting cleanup of documents older than $DAYS days..."

# Count files before deletion
COUNT=$(find "$DOCS_DIR" -name "*.md" -o -name "*.json" -mtime +$DAYS | wc -l)

# Delete old documents and their metadata
find "$DOCS_DIR" -name "*.md" -mtime +$DAYS -delete
find "$DOCS_DIR" -name "*.json" -mtime +$DAYS -delete

echo "$(date): Deleted $COUNT files"
echo "$(date): Cleanup complete"
```

Make it executable:
```bash
chmod +x /path/to/cleanup-documents.sh
```

### Manual Cleanup

```bash
# Remove documents older than 30 days
cd /path/to/MDReader/documents
find . -name "*.md" -mtime +30 -delete
find . -name "*.json" -mtime +30 -delete
```

### Windows Task Scheduler

Create `cleanup-documents.bat`:

```batch
@echo off
REM MDReader Document Cleanup Script for Windows

set DOCS_DIR=C:\path\to\MDReader\documents
set DAYS=30

echo %date% %time%: Starting cleanup...

forfiles /p "%DOCS_DIR%" /m *.md /d -%DAYS% /c "cmd /c del @path"
forfiles /p "%DOCS_DIR%" /m *.json /d -%DAYS% /c "cmd /c del @path"

echo %date% %time%: Cleanup complete
```

Schedule in Task Scheduler to run daily at 3 AM.

## Monitoring

Check disk usage regularly:

```bash
# Linux/Mac
du -sh /path/to/MDReader/documents

# Count documents
ls -1 *.md 2>/dev/null | wc -l
```

Monitor logs for errors and suspicious activity:

```bash
# Check PHP error log
tail -f /var/log/php-errors.log | grep "MDReader"

# Check for rate limit triggers
tail -f /var/log/php-errors.log | grep "Rate limit"
```
