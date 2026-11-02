export class ApiError extends Error {
  constructor(status, message, code = 'ERROR', extra = {}) {
    super(message); this.status = status; this.code = code; this.extra = extra;
  }
}
export const bad = (msg, code = 'BAD_REQUEST', extra) => new ApiError(400, msg, code, extra);
export const notFound = (msg = 'Không tìm thấy dữ liệu') => new ApiError(404, msg, 'NOT_FOUND');
