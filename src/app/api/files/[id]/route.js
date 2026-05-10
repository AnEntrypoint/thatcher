import { NextResponse } from '@/lib/next-polyfills';
import { requireUser } from '@/engine.server';
import { permissionService } from '@/services/permission.service';
import { get } from '@/engine';
import { getSpec } from '@/config/spec-helpers';
import { fileService } from '@/services/file.service';
import { HTTP } from '@/config/constants';
import { notFound } from '@/lib/response-formatter';

export async function GET(request, { params }) {
  try {
    const user = await requireUser();
    const { id } = params;

    const spec = getSpec('file');
    if (!permissionService.checkAccess(user, spec, 'view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: HTTP.FORBIDDEN });
    }

    const fileRecord = get('file', id);
    if (!fileRecord) {
      return notFound('File not found');
    }

    const content = await fileService.download(fileRecord.drive_file_id);

    const safeName = (fileRecord.file_name || 'download').replace(/[^\w.\-]/g, '_');
    return new NextResponse(content, {
      headers: {
        'Content-Type': fileRecord.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json({ error: error.message }, { status: HTTP.INTERNAL_ERROR });
  }
}
