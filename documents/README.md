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
- Maximum file size is limited to 5MB

## Maintenance

Consider implementing:
- Automatic cleanup of old documents (e.g., delete files older than 30 days)
- Database tracking for better management
- User authentication for private documents
- Document edit history

## Clean Up Script

To remove old documents, you can run:

```bash
# Remove documents older than 30 days
find . -name "doc_*" -mtime +30 -delete
```
